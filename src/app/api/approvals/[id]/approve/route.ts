/**
 * API: /api/approvals/[id]/approve
 *  POST { token } — user approves. Validates the single-use token, marks APPROVED,
 *  then runs the tool executor and marks COMPLETED / FAILED.
 *
 *  The model setting `confirmed: true` does NOT reach this endpoint. Only the UI
 *  (acting on the user's click) calls this with the token from the create response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { approveWithToken, markExecuting, markCompleted, markFailed } from '@/lib/approval';
import { writeAudit } from '@/lib/tool-validation';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const decision = await approveWithToken(id, token);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error, message: decision.message }, { status: 400 });
  }

  // Mark EXECUTING (defensive — only APPROVED rows can transition).
  const started = await markExecuting(id);
  if (!started) {
    return NextResponse.json({ error: 'ALREADY_DECIDED', message: 'approval was already executing or completed' }, { status: 409 });
  }

  // Execute the tool inline. For send_email_with_approval we log to disk (no SMTP
  // in this sandbox). For other dangerous tools added later, swap on toolName.
  const t0 = Date.now();
  try {
    const result = await executeApprovedTool(decision.toolName, decision.args);
    await markCompleted(id, result);
    await writeAudit({
      conversationId: null,
      sessionId: null,
      toolName: decision.toolName,
      args: decision.args,
      status: 'success',
      durationMs: Date.now() - t0,
      approvalId: id,
    });
    return NextResponse.json({ ok: true, status: 'COMPLETED', result });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await markFailed(id, errMsg);
    await writeAudit({
      conversationId: null,
      sessionId: null,
      toolName: decision.toolName,
      args: decision.args,
      status: 'failure',
      durationMs: Date.now() - t0,
      errorMessage: errMsg,
      approvalId: id,
    });
    return NextResponse.json({ ok: false, status: 'FAILED', error: errMsg }, { status: 500 });
  }
}

// Executor for approved tools. Add more cases as new dangerous tools land.
async function executeApprovedTool(toolName: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (toolName === 'send_email_with_approval') {
    // No SMTP relay in the sandbox — log to disk and return a "logged" success.
    // A real deployment calls the email provider here (Resend, SendGrid, SES).
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const WORKSPACE = '/home/z/my-project';
    const logDir = path.join(WORKSPACE, '.tmp-email-log');
    await mkdir(logDir, { recursive: true });
    const logLine = `[${new Date().toISOString()}] to=${args.to} subject=${args.subject}\n${args.body}\n---\n`;
    await writeFile(path.join(logDir, 'sent.log'), logLine, { flag: 'a' });
    return { delivered: 'logged', to: args.to, subject: args.subject };
  }
  throw new Error(`no executor for approved tool "${toolName}"`);
}
