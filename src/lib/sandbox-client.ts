/**
 * Sandbox client — the API server's interface to the sandbox-worker mini-service.
 *
 * The Next.js API server does NOT execute run_code_sandbox / run_shell inline.
 * It creates a SandboxJob row (status QUEUED), POSTs the job to the sandbox
 * worker (mini-services/sandbox-worker/, port 3030), and awaits the result.
 *
 * This keeps code execution OUT of the Next.js process: a crash, hang, or
 * memory blowup in the sandbox doesn't take down the API server. The worker
 * runs as a separate process with its own resource limits.
 *
 * Worker URL is configurable via SANDBOX_WORKER_URL env (default
 * http://localhost:3030). In production, point this at a load-balanced pool
 * of sandbox workers.
 *
 * See docs/agent/safety_rules.md §10 (Runtime isolation tiers) and
 * evaluation_tests.md T19-T30 (Category L).
 */

import { db } from '@/lib/db';
import { resolveWorkspacePath } from '@/lib/workspace';

const SANDBOX_WORKER_URL = process.env.SANDBOX_WORKER_URL || 'http://localhost:3030';
const WORKSPACE_STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';

export interface SandboxJobResult {
  jobId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  isolationTier: 'docker' | 'process';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorMessage: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  limits: {
    timeoutMs: number;
    maxBufferBytes: number;
    maxProcesses: number;
    memoryLimitMb: number;
    cpuLimit: string;
  };
}

/**
 * Enqueue a sandbox job. Creates a SandboxJob row, POSTs to the worker, and
 * returns the result. The worker runs synchronously (one job at a time) in dev;
 * production should swap the worker for a queue-backed pool.
 *
 * Throws if the worker is unreachable.
 */
export async function enqueueSandboxJob(opts: {
  workspaceId: string;
  conversationId?: string | null;
  sessionId?: string | null;
  toolName: 'run_code_sandbox' | 'run_shell';
  args: Record<string, unknown>;
}): Promise<SandboxJobResult> {
  // Resolve the workspace root (absolute) — the worker needs it to mount.
  // The model never sees this path; only the worker does.
  const res = await resolveWorkspacePath(opts.workspaceId, '.', 'default', { followSymlinks: false });
  if (!res.ok) {
    throw new Error(`cannot resolve workspace root: ${res.error}`);
  }
  const workspaceRoot = res.workspaceRoot;

  // Create the SandboxJob row (status QUEUED).
  const limits = {
    timeoutMs: 10_000,
    maxBufferBytes: 1_024 * 1_024,
    maxProcesses: 16,
    memoryLimitMb: 512,
    cpuLimit: '1.0',
  };
  const jobRow = await db.sandboxJob.create({
    data: {
      workspaceId: opts.workspaceId,
      conversationId: opts.conversationId ?? null,
      sessionId: opts.sessionId ?? null,
      toolName: opts.toolName,
      argsJson: JSON.stringify(opts.args),
      status: 'QUEUED',
      limitsJson: JSON.stringify(limits),
    },
  });

  // POST to the worker. The worker runs the job and returns the result.
  // Use a generous outer timeout (worker timeout + 5s) so a hung worker
  // doesn't block the API forever.
  try {
    const workerResp = await fetch(`${SANDBOX_WORKER_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: jobRow.id,
        workspaceRoot,
        toolName: opts.toolName,
        args: opts.args,
      }),
      signal: AbortSignal.timeout(limits.timeoutMs + 5000),
    });
    if (!workerResp.ok) {
      const errText = await workerResp.text().catch(() => 'unknown');
      await db.sandboxJob.update({
        where: { id: jobRow.id },
        data: { status: 'FAILED', errorMessage: `worker returned ${workerResp.status}: ${errText}`, finishedAt: new Date() },
      });
      throw new Error(`sandbox worker error: ${workerResp.status} ${errText}`);
    }
    const result = await workerResp.json() as SandboxJobResult;

    // Update the DB row with the result.
    await db.sandboxJob.update({
      where: { id: jobRow.id },
      data: {
        status: result.status,
        isolationTier: result.isolationTier,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        errorMessage: result.errorMessage,
        startedAt: result.startedAt ? new Date(result.startedAt) : null,
        finishedAt: result.finishedAt ? new Date(result.finishedAt) : null,
      },
    });

    return result;
  } catch (e: any) {
    // Worker unreachable or timed out — mark the job FAILED.
    await db.sandboxJob.update({
      where: { id: jobRow.id },
      data: {
        status: e.name === 'TimeoutError' ? 'TIMEOUT' : 'FAILED',
        errorMessage: `worker unreachable: ${e.message || String(e)}`,
        finishedAt: new Date(),
      },
    }).catch(() => {});
    throw e;
  }
}

/**
 * Check if the sandbox worker is alive (for boot-time health checks).
 * Returns the tier the worker is running ('docker' or 'process') so the
 * API can surface it to the user (e.g. in the audit log or a warning toast).
 */
export async function pingSandboxWorker(): Promise<{ ok: boolean; tier: 'docker' | 'process' | 'unreachable' }> {
  try {
    const res = await fetch(`${SANDBOX_WORKER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, tier: 'unreachable' };
    const data = await res.json() as { ok: boolean; tier: 'docker' | 'process' };
    return { ok: !!data.ok, tier: data.tier };
  } catch {
    return { ok: false, tier: 'unreachable' };
  }
}
