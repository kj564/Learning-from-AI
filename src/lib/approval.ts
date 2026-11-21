/**
 * Approval workflow library — real approval state machine for dangerous tools.
 *
 * Flow (see docs/agent/safety_rules.md §2.7, evaluation_tests.md T1-T4):
 *   1. Agent calls send_email_with_approval (or any dangerous tool).
 *   2. Backend creates an ApprovalRequest with status=PENDING_APPROVAL,
 *      a single-use token, and a 15-minute expiry.
 *   3. Backend returns { needsApproval: true, approvalId, token } to the model.
 *   4. The model surfaces the draft in its reply; the UI shows an approval card.
 *   5. User clicks Approve / Edit / Reject in the UI.
 *      - Approve: validates the token (single-use, not expired, status=PENDING),
 *        marks APPROVED, runs the executor, marks COMPLETED or FAILED.
 *      - Reject: marks REJECTED.
 *      - Edit: creates a NEW ApprovalRequest with parentApprovalId=this,
 *        marks this one SUPERSEDED (old token invalid). Returns new approvalId/token.
 *   6. A background sweep marks PENDING_APPROVAL rows past expiresAt as EXPIRED.
 *
 * Security invariants:
 *   - The model setting `confirmed: true` does NOT authorize a send. Only the
 *     user clicking Approve produces a valid token (T1).
 *   - Tokens are single-use: consumed on first Approve (T2).
 *   - Tokens expire (T3).
 *   - Editing the draft invalidates the prior approval (T4).
 *   - The draft stored in argsJson is immutable; editing creates a new row.
 *   - The backend re-validates the final args against the Zod schema before
 *     executing, even after approval.
 */

import { randomBytes, createHash, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { validateToolCall } from '@/lib/tool-validation';

export const APPROVAL_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type ApprovalStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUPERSEDED';

export interface CreateApprovalInput {
  toolName: string;
  toolUseId?: string | null;
  args: Record<string, unknown>;
  conversationId?: string | null;
  ttlMs?: number;
}

export interface CreateApprovalResult {
  approvalId: string;
  token: string; // plaintext — returned to UI once; only the hash is stored
  status: ApprovalStatus;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function genToken(): string {
  // 32 random bytes, hex-encoded = 64 chars. URL-safe.
  return randomBytes(32).toString('hex');
}

/** Create a new PENDING approval. Returns the plaintext token ONCE. */
export async function createApproval(input: CreateApprovalInput): Promise<CreateApprovalResult> {
  const token = genToken();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? APPROVAL_TTL_MS));
  const row = await db.approvalRequest.create({
    data: {
      toolName: input.toolName,
      toolUseId: input.toolUseId ?? null,
      argsJson: JSON.stringify(input.args),
      conversationId: input.conversationId ?? null,
      tokenHash: hashToken(token),
      status: 'PENDING_APPROVAL',
      expiresAt,
    },
  });
  return { approvalId: row.id, token, status: 'PENDING_APPROVAL', expiresAt };
}

export type DecisionResult =
  | { ok: true; status: 'APPROVED'; approvalId: string; toolName: string; args: Record<string, unknown> }
  | { ok: false; error: 'NOT_FOUND' | 'EXPIRED' | 'SUPERSEDED' | 'ALREADY_DECIDED' | 'BAD_TOKEN' | 'INVALID_ARGS'; message: string; args?: Record<string, unknown> };

/**
 * Validate an approve/reject decision. Does NOT execute the tool — the caller
 * (the API route) runs the executor after this returns ok.
 *
 * On success, marks the row APPROVED and returns the args for the executor to
 * re-validate and run. The row is now "consumed" — the token cannot be reused.
 */
export async function approveWithToken(approvalId: string, token: string): Promise<DecisionResult> {
  const row = await db.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!row) return { ok: false, error: 'NOT_FOUND', message: 'approval request not found' };
  if (row.tokenHash !== hashToken(token)) return { ok: false, error: 'BAD_TOKEN', message: 'invalid approval token' };

  // Status checks
  if (row.status === 'SUPERSEDED') return { ok: false, error: 'SUPERSEDED', message: 'this approval was superseded by an edit' };
  if (row.status === 'APPROVED' || row.status === 'EXECUTING' || row.status === 'COMPLETED' || row.status === 'FAILED') {
    return { ok: false, error: 'ALREADY_DECIDED', message: `approval already ${row.status.toLowerCase()}` };
  }
  if (row.status === 'REJECTED') return { ok: false, error: 'ALREADY_DECIDED', message: 'approval was rejected' };
  if (row.status === 'EXPIRED' || row.expiresAt < new Date()) {
    // Mark expired in the DB if not already (sweep also does this; doing it inline is fine).
    if (row.status === 'PENDING_APPROVAL') {
      await db.approvalRequest.update({ where: { id: approvalId }, data: { status: 'EXPIRED' } });
    }
    return { ok: false, error: 'EXPIRED', message: 'approval token expired' };
  }
  if (row.status !== 'PENDING_APPROVAL') {
    return { ok: false, error: 'ALREADY_DECIDED', message: `unexpected status ${row.status}` };
  }

  // Re-validate args against the Zod schema before approving (defence in depth).
  const args = JSON.parse(row.argsJson) as Record<string, unknown>;
  const v = validateToolCall(row.toolName, args);
  if (!v.ok) {
    await db.approvalRequest.update({
      where: { id: approvalId },
      data: { status: 'FAILED', decidedAt: new Date(), decidedBy: 'user', resultJson: JSON.stringify({ error: 'INVALID_ARGS', details: v.details }) },
    });
    return { ok: false, error: 'INVALID_ARGS', message: 'draft args failed re-validation', args };
  }

  // Mark APPROVED — token is now consumed (single-use).
  await db.approvalRequest.update({
    where: { id: approvalId },
    data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: 'user' },
  });

  return { ok: true, status: 'APPROVED', approvalId, toolName: row.toolName, args: v.args };
}

export async function rejectWithToken(approvalId: string, token: string): Promise<DecisionResult> {
  const row = await db.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!row) return { ok: false, error: 'NOT_FOUND', message: 'approval request not found' };
  if (row.tokenHash !== hashToken(token)) return { ok: false, error: 'BAD_TOKEN', message: 'invalid approval token' };
  if (row.status !== 'PENDING_APPROVAL') {
    return { ok: false, error: 'ALREADY_DECIDED', message: `approval already ${row.status.toLowerCase()}` };
  }
  if (row.expiresAt < new Date()) {
    await db.approvalRequest.update({ where: { id: approvalId }, data: { status: 'EXPIRED' } });
    return { ok: false, error: 'EXPIRED', message: 'approval token expired' };
  }
  await db.approvalRequest.update({
    where: { id: approvalId },
    data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: 'user' },
  });
  return { ok: true, status: 'APPROVED' as any, approvalId, toolName: row.toolName, args: JSON.parse(row.argsJson) };
}

/**
 * Edit a draft. Creates a NEW ApprovalRequest with parentApprovalId=this,
 * and marks this one SUPERSEDED (old token invalidated — T4).
 * Returns the new approvalId + plaintext token (single-use).
 */
export async function editApproval(
  approvalId: string,
  token: string,
  newArgs: Record<string, unknown>,
): Promise<CreateApprovalResult & { error?: string }> {
  const row = await db.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!row) return { approvalId: '', token: '', status: 'SUPERSEDED' as any, expiresAt: new Date(0), error: 'NOT_FOUND' };
  if (row.tokenHash !== hashToken(token)) return { approvalId: '', token: '', status: 'SUPERSEDED' as any, expiresAt: new Date(0), error: 'BAD_TOKEN' };
  if (row.status !== 'PENDING_APPROVAL') {
    return { approvalId: '', token: '', status: row.status as any, expiresAt: new Date(0), error: 'ALREADY_DECIDED' };
  }
  // Re-validate the new args
  const v = validateToolCall(row.toolName, newArgs);
  if (!v.ok) return { approvalId: '', token: '', status: 'SUPERSEDED' as any, expiresAt: new Date(0), error: 'INVALID_ARGS' };

  const newToken = genToken();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  const newArgsJson = JSON.stringify(v.args);
  // Create the new approval, then supersede the old one. Order matters:
  // if we supersede first, a race could see no active approval for a moment.
  const newRow = await db.approvalRequest.create({
    data: {
      toolName: row.toolName,
      toolUseId: row.toolUseId,
      argsJson: newArgsJson,
      conversationId: row.conversationId,
      tokenHash: hashToken(newToken),
      status: 'PENDING_APPROVAL',
      expiresAt,
      parentApprovalId: row.id,
    },
  });
  await db.approvalRequest.update({
    where: { id: row.id },
    data: { status: 'SUPERSEDED', decidedAt: new Date(), decidedBy: 'user' },
  });
  return { approvalId: newRow.id, token: newToken, status: 'PENDING_APPROVAL', expiresAt };
}

/** Mark the row EXECUTING before running the executor (so concurrent approves
 * on the same token — impossible since it's single-use, but defensive — see
 * the row is not already EXECUTING). Then mark COMPLETED or FAILED after. */
export async function markExecuting(approvalId: string): Promise<boolean> {
  const r = await db.approvalRequest.updateMany({
    where: { id: approvalId, status: 'APPROVED' },
    data: { status: 'EXECUTING', executedAt: new Date() },
  });
  return r.count > 0;
}

export async function markCompleted(approvalId: string, result: Record<string, unknown>): Promise<void> {
  await db.approvalRequest.update({
    where: { id: approvalId },
    data: { status: 'COMPLETED', resultJson: JSON.stringify(result) },
  });
}

export async function markFailed(approvalId: string, error: string): Promise<void> {
  await db.approvalRequest.update({
    where: { id: approvalId },
    data: { status: 'FAILED', resultJson: JSON.stringify({ error }) },
  });
}

/** Get a PENDING approval by id (for the UI to render the draft). */
export async function getApproval(approvalId: string) {
  return db.approvalRequest.findUnique({ where: { id: approvalId } });
}

/** Get the latest active (PENDING) approval for a conversation, if any. */
export async function getPendingApprovals(conversationId?: string | null) {
  return db.approvalRequest.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      expiresAt: { gt: new Date() },
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

/** Background sweep — mark PENDING_APPROVAL rows past expiry as EXPIRED.
 *  Idempotent. Safe to call from anywhere. */
export async function sweepExpiredApprovals(): Promise<number> {
  const r = await db.approvalRequest.updateMany({
    where: { status: 'PENDING_APPROVAL', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return r.count;
}
