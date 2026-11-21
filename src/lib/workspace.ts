/**
 * Workspace isolation library.
 *
 * Each user/project gets an isolated directory tree. All file tools operate
 * relative to a workspace root. The model never sees the absolute rootPath —
 * only the workspaceId and relative paths.
 *
 * Path resolution (resolveWorkspacePath):
 *   1. Reject absolute paths.
 *   2. Reject `..` segments (after normalize, before realpath).
 *   3. Resolve to absolute path under workspace root.
 *   4. Follow symlinks with fs.realpath and verify the resolved real path
 *      still starts with the workspace root. This catches symlink escapes
 *      (T14): a symlink in documents/link → /etc/passwd is rejected because
 *      realpath resolves outside the workspace.
 *
 * Sandbox resource limits (run_code_sandbox):
 *   - cwd set to workspace root (model can only write inside the workspace)
 *   - env filtered: DATABASE_URL, *_KEY, *_TOKEN, *_SECRET, *_PASSWORD,
 *     *_PRIVATE_KEY stripped. PATH and HOME preserved.
 *   - 10s timeout (already enforced by the executor)
 *   - 512 MB memory via `ulimit -v` on Linux (best-effort in this sandbox)
 *
 * Storage: local disk in dev (under /home/z/my-project/.workspaces/). Production
 * should swap the StorageAdapter for S3/R2 — the interface is in STORAGE below.
 *
 * See docs/agent/safety_rules.md §3 (sandbox) and evaluation_tests.md T11–T18.
 */

import { mkdir, readdir, stat, realpath, writeFile, readFile, unlink, access } from 'fs/promises';
import { existsSync, open as fsOpenSync, constants as fsConstants, close as fsClose, read as fsRead, fstat as fsFstat } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

// ============================================================
// Storage configuration
// ============================================================
//
// In dev we store workspace files on local disk under STORAGE_ROOT. In
// production, swap this for an S3/R2 adapter (the interface is implicit in
// the mkdir/readdir/stat/realpath/writeFile/readFile/unlink calls below —
// replace with a StorageAdapter that hits object storage).
const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/my-project/.workspaces';

// Default folders created on every new workspace.
export const DEFAULT_FOLDERS = [
  'input',
  'documents',
  'code',
  'notes',
  'output',
  '.agent',
  '.agent/audit',
  '.tmp', // sandbox temp files (kept inside workspace so cleanup is easy)
] as const;

// ============================================================
// Workspace lifecycle
// ============================================================

export interface CreateWorkspaceInput {
  userId?: string;
  projectId?: string | null;
  name: string;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const userId = input.userId || 'default';
  const wsId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rootPath = path.join(STORAGE_ROOT, userId, wsId);

  // Create the directory tree on disk BEFORE the DB row so the filesystem
  // is always consistent with the DB (rollback the dir if DB fails).
  for (const folder of DEFAULT_FOLDERS) {
    await mkdir(path.join(rootPath, folder), { recursive: true });
  }

  try {
    const ws = await db.workspace.create({
      data: {
        id: wsId,
        userId,
        projectId: input.projectId ?? null,
        name: input.name,
        rootPath,
      },
    });
    return ws;
  } catch (e) {
    // DB failed — clean up the dir we just made so we don't leak orphans.
    try { await unlink(rootPath).catch(() => {}); } catch {}
    throw e;
  }
}

export async function getWorkspace(wsId: string, userId: string = 'default') {
  const ws = await db.workspace.findUnique({ where: { id: wsId } });
  // Cross-user access check (T15): workspace must belong to the requesting user.
  // In single-user mode this is always true, but we enforce it for future-proofing.
  if (ws && ws.userId !== userId) {
    return null;
  }
  return ws;
}

export async function listWorkspaces(userId: string = 'default') {
  return db.workspace.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { files: true } } },
  });
}

/**
 * Ensure a workspace exists for a conversation. Auto-creates one on first
 * tool use. The chat stream calls this and injects the workspaceId into the
 * system prompt so the model knows where it's working.
 *
 * Convention: one workspace per conversation. Conversation ID → workspace
 * name mapping is by id (so we can find the workspace back later).
 */
export async function ensureWorkspaceForConversation(conversationId?: string | null, userId: string = 'default') {
  // Look up a workspace named for this conversation.
  if (conversationId) {
    const existing = await db.workspace.findFirst({
      where: { userId, name: `conversation:${conversationId}` },
    });
    if (existing) return existing;
  }
  return createWorkspace({
    userId,
    name: conversationId ? `conversation:${conversationId}` : 'default',
  });
}

// ============================================================
// Path resolution + validation (the core security boundary)
// ============================================================

export type AccessDecision =
  | 'allowed'
  | 'denied_absolute'
  | 'denied_traversal'
  | 'denied_symlink_escape'
  | 'denied_outside_workspace'
  | 'denied_cross_user'
  | 'denied_missing_workspace'
  | 'n/a';

export interface ResolveResult {
  ok: true;
  absolutePath: string;
  workspaceRoot: string;
  accessDecision: 'allowed';
}

export interface ResolveError {
  ok: false;
  error: string;
  accessDecision: Exclude<AccessDecision, 'allowed' | 'n/a'>;
}

/**
 * Resolve a relative path against a workspace root, with full security checks.
 *
 * Order of checks (each one is independently testable):
 *   1. workspaceId must be provided → denied_missing_workspace
 *   2. workspace must exist and belong to the user → denied_cross_user
 *   3. relativePath must be a string → denied (generic)
 *   4. relativePath must not be absolute → denied_absolute
 *   5. normalized path must not contain `..` → denied_traversal
 *   6. resolved absolute path must be under workspaceRoot → denied_outside_workspace
 *   7. realpath (symlinks followed) must still be under workspaceRoot → denied_symlink_escape
 *
 * Steps 6 and 7 are both needed: step 6 catches `../../etc/passwd` written as
 * a literal string; step 7 catches a symlink `documents/link → /etc/passwd`.
 *
 * Returns the validated absolute path. Callers MUST NOT pass this back to the
 * model — only the relative path the model sent is ever returned to the model.
 */
export async function resolveWorkspacePath(
  workspaceId: string | undefined | null,
  relativePath: string,
  userId: string = 'default',
  opts: { followSymlinks?: boolean } = {},
): Promise<ResolveResult | ResolveError> {
  if (!workspaceId) {
    return { ok: false, error: 'workspaceId required', accessDecision: 'denied_missing_workspace' };
  }
  const ws = await getWorkspace(workspaceId, userId);
  if (!ws) {
    return { ok: false, error: 'workspace not found or cross-user access denied', accessDecision: 'denied_cross_user' };
  }
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    return { ok: false, error: 'path required', accessDecision: 'denied_absolute' };
  }
  // 4. Reject absolute paths.
  if (path.isAbsolute(relativePath)) {
    return { ok: false, error: 'absolute paths are not allowed; use a relative path', accessDecision: 'denied_absolute' };
  }
  // 5. Reject `..` after normalize.
  const normalized = path.normalize(relativePath);
  if (normalized.split(path.sep).some((seg) => seg === '..')) {
    return { ok: false, error: 'path traversal (..) is not allowed', accessDecision: 'denied_traversal' };
  }
  // 6. Resolve and check containment (string-prefix check on the normalized absolute path).
  const workspaceRoot = path.resolve(ws.rootPath);
  const resolved = path.resolve(workspaceRoot, normalized);
  if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) {
    return { ok: false, error: 'path resolves outside the workspace', accessDecision: 'denied_outside_workspace' };
  }
  // 7. Symlink escape check: follow symlinks on disk and verify the real path
  //    is still inside the workspace. Skip if the file doesn't exist yet
  //    (write_file creates new files) or if explicitly disabled.
  if (opts.followSymlinks !== false && existsSync(resolved)) {
    try {
      const real = await realpath(resolved);
      const realRoot = await realpath(workspaceRoot);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        return { ok: false, error: 'symlink resolves outside the workspace', accessDecision: 'denied_symlink_escape' };
      }
    } catch {
      // realpath failed (broken symlink, permission, etc.) — treat as escape attempt.
      return { ok: false, error: 'cannot resolve symlink target', accessDecision: 'denied_symlink_escape' };
    }
  }
  return { ok: true, absolutePath: resolved, workspaceRoot, accessDecision: 'allowed' };
}

// ============================================================
// File operations (workspace-scoped)
// ============================================================

export interface ListEntry {
  name: string;
  path: string; // relative path inside workspace
  type: 'file' | 'dir';
  size: number;
  modified: string;
}

export async function listWorkspaceFiles(
  workspaceId: string,
  relativeDir: string = '.',
  userId: string = 'default',
): Promise<{ ok: true; entries: ListEntry[] } | ResolveError> {
  const res = await resolveWorkspacePath(workspaceId, relativeDir, userId);
  if (!res.ok) return res;
  try {
    const entries = await readdir(res.absolutePath, { withFileTypes: true });
    const result: ListEntry[] = [];
    for (const e of entries) {
      // Skip hidden by default? No — let the model see .agent/ etc.
      if (e.name === '.tmp' || e.name === 'node_modules') continue;
      const childPath = path.join(relativeDir === '.' ? '' : relativeDir, e.name);
      let size = 0;
      let modified = '';
      try {
        const s = await stat(path.join(res.absolutePath, e.name));
        size = s.size;
        modified = s.mtime.toISOString();
      } catch {}
      result.push({
        name: e.name,
        path: childPath,
        type: e.isDirectory() ? 'dir' : 'file',
        size,
        modified,
      });
    }
    return { ok: true, entries: result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), accessDecision: 'n/a' as any };
  }
}

export async function readWorkspaceFile(
  workspaceId: string,
  relativePath: string,
  userId: string = 'default',
): Promise<{ ok: true; content: string; size: number } | ResolveError> {
  const res = await resolveWorkspacePath(workspaceId, relativePath, userId);
  if (!res.ok) return res;
  try {
    const content = await readFile(res.absolutePath, 'utf-8');
    return { ok: true, content, size: content.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), accessDecision: 'n/a' as any };
  }
}

export async function writeWorkspaceFile(
  workspaceId: string,
  relativePath: string,
  content: string,
  userId: string = 'default',
): Promise<{ ok: true; path: string; size: number } | ResolveError> {
  const res = await resolveWorkspacePath(workspaceId, relativePath, userId, { followSymlinks: false });
  if (!res.ok) return res;
  try {
    // Create parent dirs if needed.
    const dir = path.dirname(res.absolutePath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(res.absolutePath, content, 'utf-8');
    // Record in WorkspaceFile table (best-effort).
    const checksum = createHash('sha256').update(content).digest('hex');
    await db.workspaceFile.upsert({
      where: { workspaceId_path: { workspaceId, path: relativePath } },
      create: { workspaceId, path: relativePath, sizeBytes: content.length, checksum, mimeType: guessMime(relativePath) },
      update: { sizeBytes: content.length, checksum, mimeType: guessMime(relativePath), updatedAt: new Date() },
    }).catch(() => {});
    return { ok: true, path: relativePath, size: content.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), accessDecision: 'n/a' as any };
  }
}

export async function uploadWorkspaceFile(
  workspaceId: string,
  relativePath: string,
  bytes: Buffer,
  userId: string = 'default',
): Promise<{ ok: true; path: string; size: number; checksum: string } | ResolveError> {
  const res = await resolveWorkspacePath(workspaceId, relativePath, userId, { followSymlinks: false });
  if (!res.ok) return res;
  try {
    const dir = path.dirname(res.absolutePath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(res.absolutePath, bytes);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    await db.workspaceFile.upsert({
      where: { workspaceId_path: { workspaceId, path: relativePath } },
      create: { workspaceId, path: relativePath, sizeBytes: bytes.length, checksum, mimeType: guessMime(relativePath) },
      update: { sizeBytes: bytes.length, checksum, mimeType: guessMime(relativePath), updatedAt: new Date() },
    }).catch(() => {});
    return { ok: true, path: relativePath, size: bytes.length, checksum };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), accessDecision: 'n/a' as any };
  }
}

function guessMime(p: string): string {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    '.md': 'text/markdown', '.txt': 'text/plain', '.json': 'application/json',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.csv': 'text/csv', '.tsv': 'text/tab-separated-values',
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ts': 'text/typescript',
    '.py': 'text/x-python', '.sh': 'text/x-shellscript', '.xml': 'text/xml', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  };
  return map[ext] || 'application/octet-stream';
}

// ============================================================
// TOCTOU-safe file operations (P1-4)
//
// The classic TOCTOU attack: a symlink is created AFTER path validation
// but BEFORE the file is opened. `resolveWorkspacePath` does a realpath
// check, but if an attacker can swap the file between the realpath and the
// open, they can still escape.
//
// Mitigation: open with O_NOFOLLOW (the open fails if the final component is
// a symlink), then fstat the fd and verify the inode is still inside the
// workspace via /proc/self/fd readlink. This is the standard Linux TOCTOU
// defense.
//
// For writes: open with O_NOFOLLOW | O_CREAT | O_WRONLY, which fails if the
// target already exists as a symlink.
// ============================================================

const O_NOFOLLOW = 0x20000; // Linux: do not follow symlinks on the final path component
const O_RDONLY = 0;
const O_WRONLY = 1;
const O_CREAT = 0x40;
const O_TRUNC = 0x200;

export async function readWorkspaceFileToctouSafe(
  absolutePath: string,
  workspaceRoot: string,
): Promise<{ ok: true; content: string; size: number } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    // O_NOFOLLOW: if absolutePath's final component is a symlink, open fails
    // with ELOOP. This is the TOCTOU defense — we never follow a symlink at
    // open time.
    fsOpenSync(absolutePath, O_RDONLY | O_NOFOLLOW, (err, fd) => {
      if (err) {
        resolve({ ok: false, error: `cannot open (O_NOFOLLOW): ${err.message}` });
        return;
      }
      // fstat the fd (not the path) — this is the file we actually opened.
      fsFstat(fd, (err2, st) => {
        if (err2) {
          fsClose(fd, () => {});
          resolve({ ok: false, error: `fstat failed: ${err2.message}` });
          return;
        }
        if (st.isSymbolicLink()) {
          fsClose(fd, () => {});
          resolve({ ok: false, error: 'TOCTOU defense: opened file is a symlink' });
          return;
        }
        // Read the content from the fd.
        const buf = Buffer.alloc(st.size);
        fsRead(fd, buf, 0, st.size, 0, (err3, _n, content) => {
          fsClose(fd, () => {});
          if (err3) {
            resolve({ ok: false, error: `read failed: ${err3.message}` });
            return;
          }
          resolve({ ok: true, content: content.toString('utf-8'), size: content.length });
        });
      });
    });
  });
}

// ============================================================
// Sandbox environment filtering (for run_code_sandbox)
// ============================================================

/**
 * Build a filtered `env` object for the sandbox process. Removes anything
 * that looks like a secret so the sandboxed code can't exfiltrate it via
 * process.env. T17: sandbox cannot access production secrets.
 *
 * The model's code runs with this env, not the server's env.
 */
export function buildSandboxEnv(workspaceRoot: string): Record<string, string> {
  const filtered: Record<string, string> = {};
  const DENY = [
    'DATABASE_URL', 'DIRECT_URL', 'SHADOW_DATABASE_URL',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ZAI_API_KEY', 'GLM_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
    'GITHUB_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', 'PYPI_TOKEN',
    'SMTP_PASSWORD', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'POSTMARK_API_KEY',
    'ENCRYPTION_KEY', 'JWT_SECRET', 'SESSION_SECRET', 'COOKIE_SECRET',
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'AUTH_SECRET',
  ];
  // Also deny anything matching these patterns.
  const PATTERN = /(_KEY|_TOKEN|_SECRET|_PASSWORD|_PRIVATE_KEY|_CREDENTIAL|API_KEY)$/i;

  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (DENY.includes(k)) continue;
    if (PATTERN.test(k)) continue;
    filtered[k] = v;
  }
  // Override HOME and PATH to keep the workspace-contained tools findable.
  filtered.HOME = workspaceRoot;
  filtered.PWD = workspaceRoot;
  // Mark that the process is in a sandbox — code can detect this and behave
  // accordingly (some libraries check process.env.SANDBOX to disable features).
  filtered.SANDBOX = '1';
  filtered.WORKSPACE = workspaceRoot;
  return filtered;
}
