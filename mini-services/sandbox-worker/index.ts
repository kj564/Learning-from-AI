/**
 * Sandbox Worker — isolated execution service for run_code_sandbox / run_shell.
 *
 * This is a SEPARATE process from the Next.js API server. The API server
 * enqueues jobs via HTTP (POST /run) and polls for results (GET /job/:id).
 * The worker runs each job with the strongest isolation available:
 *
 *   1. Docker (if detected) — `docker run --network none --read-only --memory
 *      512m --cpus 1 --user nobody -v <workspace>:/workspace:rw --rm`
 *   2. Process (fallback) — `child_process.execFile` with:
 *      - env: {} (completely empty — no inheritance, no PATH)
 *      - cwd: workspace root
 *      - timeout: 10s (kills the process)
 *      - maxBuffer: 1 MB
 *      - detached: true (so we can kill the whole process tree on timeout)
 *
 * === HONEST LIMITATIONS (process tier) ===
 * The process tier is NOT OS-level isolation. A determined adversary running
 * untrusted code in this tier could:
 *   - Read world-readable host files (/etc/hostname, /etc/passwd, etc.) via
 *     Node's fs APIs — Node does not respect cwd for absolute paths.
 *   - Fork bomb, exhaust file descriptors, or consume CPU until the timeout.
 *   - Open sockets to external hosts (network is NOT restricted in process tier).
 *   - Probe for credentials in /tmp, /var, the project directory.
 *
 * The empty env prevents leaking OUR secrets via process.env, but the process
 * still shares the host filesystem and network. This is acceptable for:
 *   - Dev/internal use where the code is trusted (you wrote it, or the model
 *     wrote it for a task you understand).
 *   - Arithmetic, data transforms, file parsing — deterministic work.
 *
 * It is NOT acceptable for:
 *   - Running untrusted user-supplied code from the internet.
 *   - Production multi-user deployments.
 *   - Any case where the model might produce adversarial code.
 *
 * For those, deploy with Docker (or gVisor/Firecracker) — the worker detects
 * Docker at boot and uses it automatically.
 *
 * Port: 3030. Start with `bun run dev` (hot reload) or `bun index.ts`.
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, unlink, stat, readFile } from 'fs/promises';
import { existsSync, open, constants } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const PORT = 3030;

// ============================================================
// Isolation tier detection
// ============================================================

type IsolationTier = 'docker' | 'process';

async function detectTier(): Promise<IsolationTier> {
  try {
    await execAsync('docker --version', { timeout: 3000 });
    // Verify the daemon is actually running (not just the binary installed).
    await execAsync('docker info', { timeout: 5000 });
    console.log('[sandbox-worker] Docker detected — using docker isolation tier');
    return 'docker';
  } catch {
    console.log('[sandbox-worker] Docker not available — using PROCESS tier (NOT OS-level isolation)');
    console.log('[sandbox-worker] WARNING: process tier is dev-only. Do NOT run untrusted code.');
    return 'process';
  }
}

const TIER = await detectTier();

// ============================================================
// Hard limits (recorded per-job so audits can verify)
// ============================================================

const LIMITS = {
  timeoutMs: 10_000,
  maxBufferBytes: 1_024 * 1_024, // 1 MB output cap
  maxProcesses: 16,
  memoryLimitMb: 512,
  cpuLimit: '1.0',
};

// ============================================================
// Job storage (in-memory for dev; swap for Redis/BullMQ in production)
// ============================================================

interface Job {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  isolationTier: IsolationTier;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorMessage: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  limits: typeof LIMITS;
}

const jobs = new Map<string, Job>();

// ============================================================
// Workspace path resolution (mirrors src/lib/workspace.ts but standalone)
// ============================================================

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';

function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string | null {
  if (!relativePath || typeof relativePath !== 'string') return null;
  if (path.isAbsolute(relativePath)) return null;
  const normalized = path.normalize(relativePath);
  if (normalized.split(path.sep).some((seg) => seg === '..')) return null;
  const resolved = path.resolve(workspaceRoot, normalized);
  if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) return null;
  return resolved;
}

// ============================================================
// Execution: process tier
// ============================================================

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runInProcess(
  workspaceRoot: string,
  command: string,
  args: string[],
  stdin?: string,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // CRITICAL: env is {} (completely empty). The child gets NO env vars —
    // not PATH, not HOME, not DATABASE_URL, nothing. We add ONLY the bare
    // minimum the runtime needs (PATH for the interpreter, HOME = workspace).
    const minimalEnv: Record<string, string> = {
      PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: workspaceRoot,
      PWD: workspaceRoot,
      SANDBOX: '1',
      WORKSPACE: workspaceRoot,
      // Node needs this to not try to write to ~/.npm or similar.
      NODE_ENV: 'production',
    };

    const child = execFile(command, args, {
      cwd: workspaceRoot,
      timeout: LIMITS.timeoutMs,
      maxBuffer: LIMITS.maxBufferBytes,
      env: minimalEnv,
      // detached so we can kill the whole process tree on timeout.
      detached: true,
      // shell: false — never let the command be interpreted by a shell.
      shell: false,
    } as any, (err, stdout, stderr) => {
      if (err) {
        // err.killed is true if the timeout fired.
        if ((err as any).killed || (err as any).signal === 'SIGTERM' || (err as any).signal === 'SIGKILL') {
          reject(new Error(`TIMEOUT: process killed after ${LIMITS.timeoutMs}ms`));
        } else {
          // Non-zero exit — return the output + exit code, don't reject.
          // The caller decides whether non-zero is a failure.
          resolve({
            stdout: stdout?.toString() || '',
            stderr: stderr?.toString() || (err as Error).message,
            exitCode: (err as any).code ?? 1,
          });
        }
      } else {
        resolve({
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || '',
          exitCode: 0,
        });
      }
    });

    // If stdin is provided (for bash/sh code), write it.
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    // Safety net: if the timeout doesn't fire (race), kill the process tree
    // manually after the timeout + 2s grace.
    const safetyNet = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }, LIMITS.timeoutMs + 2000);
    child.on('close', () => clearTimeout(safetyNet));
  });
}

// ============================================================
// Execution: docker tier (production-grade)
// ============================================================

async function runInDocker(
  workspaceRoot: string,
  command: string,
  args: string[],
  stdin?: string,
): Promise<RunResult> {
  // Build the docker run command with all the isolation flags.
  //   --network none        — no network access (T20)
  //   --read-only           — root filesystem is read-only (T19, T24)
  //   --memory 512m         — memory limit (T23)
  //   --cpus 1              — CPU limit
  //   --pids-limit 16       — max processes (T22)
  //   --user nobody:nogroup  — non-root (T19)
  //   --cap drop ALL        — no Linux capabilities
  //   --security-opt no-new-privileges — no privilege escalation
  //   --tmpfs /tmp          — ephemeral /tmp inside the container
  //   -v workspace:/workspace:rw — mount ONLY the user's workspace
  //   --rm                  — destroy container after exit (P0-9)
  //   --workdir /workspace  — cwd = workspace
  const dockerArgs = [
    'run', '--rm', '-i',
    '--network', 'none',
    '--read-only',
    '--memory', `${LIMITS.memoryLimitMb}m`,
    '--cpus', LIMITS.cpuLimit,
    '--pids-limit', String(LIMITS.maxProcesses),
    '--user', 'nobody:nogroup',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--tmpfs', '/tmp:size=64m,mode=1777',
    '-v', `${workspaceRoot}:/workspace:rw`,
    '--workdir', '/workspace',
    '--name', `sandbox-${randomUUID().slice(0, 8)}`,
  ];
  // Image: use a minimal one. In production, pin the digest for reproducibility.
  // For dev, use a known image. The worker doesn't bundle images — you must
  // `docker pull` them first.
  const IMAGE = process.env.SANDBOX_DOCKER_IMAGE || 'node:20-slim';
  dockerArgs.push(IMAGE, command, ...args);

  try {
    const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
      timeout: LIMITS.timeoutMs,
      maxBuffer: LIMITS.maxBufferBytes,
      // Don't inherit env — docker doesn't need host env vars.
      env: { PATH: '/usr/local/bin:/usr/bin:/bin' },
      // Pass stdin if provided (for bash code).
      ...({ input: stdin } as any),
    } as any);
    return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
  } catch (e: any) {
    if (e.killed || e.signal === 'SIGTERM' || e.signal === 'SIGKILL') {
      throw new Error(`TIMEOUT: container killed after ${LIMITS.timeoutMs}ms`);
    }
    return {
      stdout: e.stdout || '',
      stderr: e.stderr || e.message,
      exitCode: e.code ?? 1,
    };
  }
}

// ============================================================
// Job execution entry point
// ============================================================

interface JobRequest {
  jobId: string;
  workspaceRoot: string;
  toolName: 'run_code_sandbox' | 'run_shell';
  args: {
    code?: string;
    command?: string;
    language?: string;
  };
}

async function executeJob(req: JobRequest): Promise<Job> {
  const job: Job = {
    id: req.jobId,
    status: 'RUNNING',
    isolationTier: TIER,
    stdout: '',
    stderr: '',
    exitCode: null,
    errorMessage: null,
    startedAt: Date.now(),
    finishedAt: null,
    limits: LIMITS,
  };
  jobs.set(job.id, job);

  try {
    const { workspaceRoot, toolName, args } = req;
    let result: RunResult;
    let command: string;
    let cmdArgs: string[];
    let stdin: string | undefined;

    if (toolName === 'run_code_sandbox') {
      const lang = args.language || 'javascript';
      const code = args.code || '';
      if (TIER === 'docker') {
        // In Docker: write the code to a temp file inside the mounted workspace,
        // then run the interpreter pointing at /workspace/.tmp/<file>.
        const tmpDir = path.join(workspaceRoot, '.tmp');
        if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
        const runners: Record<string, { cmd: string; argsFn: (f: string) => string[]; ext: string }> = {
          javascript: { cmd: 'node', argsFn: (f) => [f], ext: 'js' },
          typescript: { cmd: 'bun', argsFn: (f) => ['run', f], ext: 'ts' },
          python: { cmd: 'python3', argsFn: (f) => [f], ext: 'py' },
        };
        if (lang === 'bash' || lang === 'sh') {
          // For bash, pipe the code as stdin to `bash -s`.
          command = 'bash'; cmdArgs = ['-s']; stdin = code;
        } else {
          const runner = runners[lang];
          if (!runner) throw new Error(`unsupported language: ${lang}`);
          const tmpFile = path.join(tmpDir, `job-${req.jobId}.${runner.ext}`);
          await writeFile(tmpFile, code, 'utf-8');
          command = runner.cmd; cmdArgs = runner.argsFn(`/workspace/.tmp/${path.basename(tmpFile)}`);
        }
        result = await runInDocker(workspaceRoot, command, cmdArgs, stdin);
      } else {
        // Process tier — write to workspace .tmp/, run the interpreter.
        const tmpDir = path.join(workspaceRoot, '.tmp');
        if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
        const runners: Record<string, { cmd: string; argsFn: (f: string) => string[]; ext: string }> = {
          javascript: { cmd: 'node', argsFn: (f) => [f], ext: 'js' },
          typescript: { cmd: 'bun', argsFn: (f) => ['run', f], ext: 'ts' },
          python: { cmd: 'python3', argsFn: (f) => [f], ext: 'py' },
        };
        if (lang === 'bash' || lang === 'sh') {
          command = 'bash'; cmdArgs = ['-s']; stdin = code;
        } else {
          const runner = runners[lang];
          if (!runner) throw new Error(`unsupported language: ${lang}`);
          const tmpFile = path.join(tmpDir, `job-${req.jobId}.${runner.ext}`);
          await writeFile(tmpFile, code, 'utf-8');
          command = runner.cmd; cmdArgs = runner.argsFn(tmpFile);
        }
        result = await runInProcess(workspaceRoot, command, cmdArgs, stdin);
        // Cleanup temp file.
        if (lang !== 'bash' && lang !== 'sh') {
          const tmpFile = path.join(tmpDir, `job-${req.jobId}.${(runners as any)[lang]?.ext || 'js'}`);
          await unlink(tmpFile).catch(() => {});
        }
      }
    } else {
      // run_shell
      const cmd = args.command || '';
      if (TIER === 'docker') {
        command = 'bash'; cmdArgs = ['-c', cmd];
        result = await runInDocker(workspaceRoot, command, cmdArgs);
      } else {
        // Process tier: use exec (with shell) so the command can use pipes,
        // &&, etc. Env is still {} — only the bare minimum.
        command = 'bash'; cmdArgs = ['-c', cmd];
        result = await runInProcess(workspaceRoot, command, cmdArgs);
      }
    }

    job.stdout = result.stdout;
    job.stderr = result.stderr;
    job.exitCode = result.exitCode;
    job.status = result.exitCode === 0 ? 'COMPLETED' : 'FAILED';
  } catch (e: any) {
    job.errorMessage = e.message || String(e);
    job.status = e.message?.startsWith('TIMEOUT') ? 'TIMEOUT' : 'FAILED';
    job.stderr = job.errorMessage;
  } finally {
    job.finishedAt = Date.now();
  }
  return job;
}

// ============================================================
// HTTP server (minimal — no framework, just Bun.serve)
// ============================================================

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // GET /health — liveness + tier report
    if (url.pathname === '/health' && req.method === 'GET') {
      return Response.json({ ok: true, tier: TIER, limits: LIMITS, jobs: jobs.size }, { headers: cors });
    }

    // GET /job/:id — poll for job result
    const jobMatch = url.pathname.match(/^\/job\/(.+)$/);
    if (jobMatch && req.method === 'GET') {
      const job = jobs.get(jobMatch[1]);
      if (!job) return Response.json({ error: 'job not found' }, { status: 404, headers: cors });
      return Response.json(job, { headers: cors });
    }

    // POST /run — enqueue a job. Runs synchronously (await the result) since
    // we have one worker; in production this would enqueue to a queue and
    // return immediately with a jobId for polling.
    if (url.pathname === '/run' && req.method === 'POST') {
      const body = await req.json() as JobRequest;
      if (!body.jobId || !body.workspaceRoot || !body.toolName) {
        return Response.json({ error: 'jobId, workspaceRoot, toolName required' }, { status: 400, headers: cors });
      }
      // Validate workspaceRoot is under STORAGE_ROOT (defense in depth).
      const resolved = path.resolve(body.workspaceRoot);
      if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
        return Response.json({ error: 'workspaceRoot outside storage root' }, { status: 400, headers: cors });
      }
      try {
        const job = await executeJob(body);
        return Response.json(job, { headers: cors });
      } catch (e: any) {
        return Response.json({ error: e.message || String(e) }, { status: 500, headers: cors });
      }
    }

    return Response.json({ error: 'not found' }, { status: 404, headers: cors });
  },
});

console.log(`[sandbox-worker] listening on http://localhost:${PORT} (tier: ${TIER})`);
