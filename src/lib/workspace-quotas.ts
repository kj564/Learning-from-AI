/**
 * Workspace quotas (P1-1).
 *
 * Limits per workspace (enforced on every file write + sandbox run):
 *   - Max storage bytes: 100 MB
 *   - Max file count: 500
 *   - Max single upload size: 20 MB
 *   - Max sandbox runtime: 30s (worker enforces; this is the policy source)
 *   - Max output size: 1 MB (worker maxBuffer)
 *   - Max concurrent sandbox jobs per workspace: 1
 *
 * Without quotas, one user could make the agent write huge files repeatedly
 * or run heavy jobs. Quotas are checked at the API layer (before disk write)
 * and recorded in the audit log when exceeded.
 */

import { db } from '@/lib/db';
import { stat } from 'fs/promises';
import { readdir, existsSync } from 'fs';
import path from 'path';
import { resolveWorkspacePath } from '@/lib/workspace';

export const QUOTAS = {
  maxStorageBytes: 100 * 1024 * 1024,       // 100 MB per workspace
  maxFileCount: 500,                         // 500 files per workspace
  maxUploadBytes: 20 * 1024 * 1024,          // 20 MB per single upload
  maxSandboxRuntimeMs: 30_000,               // 30s per sandbox job (worker enforces 10s default)
  maxOutputBytes: 1024 * 1024,               // 1 MB output per sandbox job
  maxConcurrentJobs: 1,                      // 1 concurrent sandbox job per workspace
} as const;

export interface QuotaCheck {
  ok: boolean;
  quota: keyof typeof QUOTAS | null;
  limit: number;
  current: number;
  message: string;
}

/**
 * Compute current usage for a workspace by walking the directory tree.
 * This is O(files) — for huge workspaces, cache the result or use the
 * WorkspaceFile table as the source of truth (the table is kept in sync
 * on every write, so a SUM over it is faster for large workspaces).
 */
async function computeUsage(workspaceRoot: string): Promise<{ bytes: number; files: number }> {
  if (!existsSync(workspaceRoot)) return { bytes: 0, files: 0 };
  let bytes = 0;
  let files = 0;
  const walk = (dir: string) => new Promise<void>((resolve, reject) => {
    readdir(dir, { withFileTypes: true }, async (err, entries) => {
      if (err) return resolve(); // unreadable dir — skip
      await Promise.all(entries.map(async (e) => {
        if (e.name === '.tmp' || e.name === 'node_modules') return;
        const full = path.join(dir, e.name);
        try {
          if (e.isDirectory()) {
            await walk(full);
          } else {
            const s = await stat(full);
            bytes += s.size;
            files += 1;
          }
        } catch {}
      }));
      resolve();
    });
  });
  await walk(workspaceRoot);
  return { bytes, files };
}

/** Check storage + file-count quota before a write. */
export async function checkStorageQuota(
  workspaceId: string,
  additionalBytes: number,
  additionalFiles: number = 1,
): Promise<QuotaCheck> {
  const res = await resolveWorkspacePath(workspaceId, '.', 'default', { followSymlinks: false });
  if (!res.ok) return { ok: false, quota: null, limit: 0, current: 0, message: res.error };
  const usage = await computeUsage(res.workspaceRoot);
  if (usage.bytes + additionalBytes > QUOTAS.maxStorageBytes) {
    return {
      ok: false,
      quota: 'maxStorageBytes',
      limit: QUOTAS.maxStorageBytes,
      current: usage.bytes,
      message: `workspace storage quota exceeded: ${usage.bytes + additionalBytes} > ${QUOTAS.maxStorageBytes} bytes`,
    };
  }
  if (usage.files + additionalFiles > QUOTAS.maxFileCount) {
    return {
      ok: false,
      quota: 'maxFileCount',
      limit: QUOTAS.maxFileCount,
      current: usage.files,
      message: `workspace file count quota exceeded: ${usage.files + additionalFiles} > ${QUOTAS.maxFileCount}`,
    };
  }
  return { ok: true, quota: null, limit: 0, current: usage.bytes, message: '' };
}

/** Check single-upload size against maxUploadBytes. */
export function checkUploadSize(size: number): QuotaCheck {
  if (size > QUOTAS.maxUploadBytes) {
    return {
      ok: false,
      quota: 'maxUploadBytes',
      limit: QUOTAS.maxUploadBytes,
      current: size,
      message: `upload exceeds max size: ${size} > ${QUOTAS.maxUploadBytes} bytes`,
    };
  }
  return { ok: true, quota: null, limit: 0, current: size, message: '' };
}

/** Check concurrent sandbox jobs (max 1 per workspace). */
export async function checkConcurrentJobs(workspaceId: string): Promise<QuotaCheck> {
  const running = await db.sandboxJob.count({
    where: { workspaceId, status: { in: ['QUEUED', 'RUNNING'] } },
  });
  if (running >= QUOTAS.maxConcurrentJobs) {
    return {
      ok: false,
      quota: 'maxConcurrentJobs',
      limit: QUOTAS.maxConcurrentJobs,
      current: running,
      message: `workspace already has ${running} running sandbox job(s); max ${QUOTAS.maxConcurrentJobs}`,
    };
  }
  return { ok: true, quota: null, limit: 0, current: running, message: '' };
}
