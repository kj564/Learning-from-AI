/**
 * Tool schema validation (Zod) + tool-call audit logging.
 *
 * Every tool call from the model is validated against a Zod schema before the
 * executor runs. Invalid calls return `{ success: false, is_error: true,
 * error: "INVALID_ARGUMENTS", details }` — never reaching the executor.
 *
 * Every tool call (success, failure, invalid, or denied) is recorded in the
 * ToolCallAudit table for observability and cost control.
 *
 * See docs/agent/safety_rules.md §3 (sandbox) and docs/agent/evaluation_tests.md
 * tests T5 (schema), T6 (no retry), T9 (MAX_STEPS), T10 (path traversal).
 */

import { z } from 'zod';
import { db } from '@/lib/db';

// ============================================================
// Zod schemas for the 8 core tools (+ companions).
// Keep these in sync with the AgentTool definitions in agent-tools.ts
// and with docs/agent/tools.md.
// ============================================================

const emailSchema = z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalid email address');

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  web_search: z.object({
    query: z.string().min(1).max(500),
    max_results: z.number().int().min(1).max(10).optional(),
  }),

  read_url: z.object({
    url: z.string().url('must be a fully-qualified URL'),
  }),

  search_knowledge_base: z.object({
    query: z.string().min(1).max(500),
    top_k: z.number().int().min(1).max(10).optional(),
  }),

  read_file: z.object({
    path: z.string().min(1).max(500).refine((p) => !p.startsWith('/') && !p.includes('..'), 'path must be relative and contain no .. segments'),
  }),

  list_dir: z.object({
    path: z.string().min(1).max(500).optional(),
    dir: z.string().min(1).max(500).optional(),
  }),

  write_file: z.object({
    path: z.string().min(1).max(500).refine((p) => !p.startsWith('/') && !p.includes('..'), 'path must be relative and contain no .. segments'),
    content: z.string().max(5_000_000, 'file content exceeds 5 MB limit'),
  }),

  edit_file: z.object({
    path: z.string().min(1).max(500).refine((p) => !p.startsWith('/') && !p.includes('..'), 'path must be relative'),
    old_text: z.string().min(1),
    new_text: z.string(),
    replace_all: z.boolean().optional(),
  }),

  run_code_sandbox: z.object({
    code: z.string().min(1).max(500_000, 'code exceeds 500 KB limit'),
    language: z.enum(['javascript', 'typescript', 'python', 'bash']).optional(),
  }),

  run_shell: z.object({
    command: z.string().min(1).max(50_000, 'command exceeds 50 KB limit'),
  }),

  create_note: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10_000),
    category: z.enum(['preference', 'decision', 'finding', 'error_pattern', 'source']),
  }),

  recall_memory: z.object({
    query: z.string().min(1).max(500),
  }),

  search_knowledge_base_alias: z.object({
    query: z.string().min(1).max(500),
    top_k: z.number().int().min(1).max(10).optional(),
  }),

  send_email_with_approval: z.object({
    to: emailSchema,
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(50_000),
    // Internal flag — set ONLY by the /api/approvals/[id]/approve handler.
    // The model setting `confirmed: true` does NOT authorize the send; only
    // an authenticated user clicking Approve does.
    confirmed: z.boolean().optional(),
    approvalToken: z.string().optional(),
  }),

  // Legacy aliases (kept for backward compat with older model turns).
  file_write: z.object({
    path: z.string().min(1).max(500),
    content: z.string().max(5_000_000),
  }),
  file_read: z.object({
    path: z.string().min(1).max(500),
  }),
  file_list: z.object({
    dir: z.string().min(1).max(500).optional(),
  }),
  code_run: z.object({
    code: z.string().min(1).max(500_000),
    language: z.string().optional(),
  }),
  shell_run: z.object({
    command: z.string().min(1).max(50_000),
  }),
  knowledge_search: z.object({
    query: z.string().min(1).max(500),
    topK: z.number().int().min(1).max(10).optional(),
  }),
  image_generate: z.object({
    prompt: z.string().min(1).max(2000),
    size: z.string().optional(),
  }),
  image_search: z.object({
    query: z.string().min(1).max(500),
    count: z.number().int().min(1).max(20).optional(),
  }),
  npm_install: z.object({
    packages: z.array(z.string().min(1).max(200)).min(1).max(50),
  }),
  project_create: z.object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'invalid project name'),
  }),
};

// ============================================================
// Validation result
// ============================================================

export type ValidationResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: 'INVALID_ARGUMENTS'; details: any };

export function validateToolCall(tool: string, args: Record<string, unknown>): ValidationResult {
  const schema = TOOL_SCHEMAS[tool];
  if (!schema) {
    return {
      ok: false,
      error: 'INVALID_ARGUMENTS',
      details: { tool, message: `no schema registered for tool "${tool}"` },
    };
  }
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_ARGUMENTS',
      details: parsed.error.issues?.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })) ?? parsed.error.toString(),
    };
  }
  return { ok: true, args: parsed.data as Record<string, unknown> };
}

// ============================================================
// Audit logging
// ============================================================

export interface AuditInput {
  conversationId?: string | null;
  sessionId?: string | null;
  toolName: string;
  args: Record<string, unknown>;
  status: 'success' | 'failure' | 'denied' | 'invalid' | 'pending';
  durationMs: number;
  retries?: number;
  errorMessage?: string | null;
  resultTruncated?: boolean;
  resultBytes?: number;
  approvalId?: string | null;
  validationError?: string | null;
}

const ARGS_MAX_BYTES = 8 * 1024;

function truncateArgs(args: Record<string, unknown>): string {
  const json = JSON.stringify(args);
  if (Buffer.byteLength(json, 'utf-8') <= ARGS_MAX_BYTES) return json;
  // Truncate the longest string fields first to preserve structure
  const trimmed: Record<string, unknown> = { ...args };
  for (const k of Object.keys(trimmed)) {
    if (typeof trimmed[k] === 'string' && (trimmed[k] as string).length > 1024) {
      trimmed[k] = (trimmed[k] as string).slice(0, 1024) + '…[truncated]';
    }
  }
  const trimmedJson = JSON.stringify(trimmed);
  return trimmedJson.slice(0, ARGS_MAX_BYTES);
}

export async function writeAudit(input: AuditInput): Promise<string | null> {
  try {
    const row = await db.toolCallAudit.create({
      data: {
        conversationId: input.conversationId ?? null,
        sessionId: input.sessionId ?? null,
        toolName: input.toolName,
        argsJson: truncateArgs(input.args),
        status: input.status,
        durationMs: input.durationMs,
        retries: input.retries ?? 0,
        errorMessage: input.errorMessage ?? null,
        resultTruncated: input.resultTruncated ?? false,
        resultBytes: input.resultBytes ?? 0,
        approvalId: input.approvalId ?? null,
        validationError: input.validationError ?? null,
      },
    });
    return row.id;
  } catch (e) {
    // Audit failures must not break the tool call flow — log to stderr.
    console.error('[audit] failed to write tool call audit:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ============================================================
// Centralized retry policy
//
//   - Transient errors (network, timeout, 5xx): retry once with same args.
//   - Usage errors (schema invalid, wrong args): do NOT retry.
//   - Policy denials (BLOCK list): do NOT retry, do NOT bypass.
//   - After 1 retry on a transient error, stop and report.
//
// T6 in evaluation_tests.md: "Agent tidak boleh retry tool call identik
// lebih dari satu kali."
// ============================================================

export type RetryClassification = 'transient' | 'usage' | 'policy' | 'success';

export function classifyError(errorMsg: string): RetryClassification {
  const e = errorMsg.toLowerCase();
  if (e.includes('timeout') || e.includes('etimedout') || e.includes('enetwork') ||
      e.includes('econnreset') || e.includes('econnrefused') || e.includes('fetch failed') ||
      e.includes('socket hang up') || e.includes('503') || e.includes('502') ||
      e.includes('rate limit') || e.includes('429')) {
    return 'transient';
  }
  if (e.includes('invalid_arguments') || e.includes('invalid argument') ||
      e.includes('not found') || e.includes('required') || e.includes('must be')) {
    return 'usage';
  }
  if (e.includes('denied') || e.includes('blocked') || e.includes('not permitted') ||
      e.includes('blocked by policy') || e.includes('block list')) {
    return 'policy';
  }
  return 'transient'; // default — safer to retry once than to fail hard
}
