/**
 * keepalive.ts — start Next.js via Bun and keep it alive.
 *
 * Bun processes survive bash subshell exit in this sandbox (the sandbox-worker
 * at PID 1318 is proof). Node processes don't. So we use Bun to spawn Next.js
 * as a child process and wait on it. If Next.js crashes, we restart it.
 *
 * Usage: bun keepalive.ts
 */

import { spawn } from 'child_process';

const NEXT_BIN = '/home/z/my-project/node_modules/.bin/next';
const ARGS = ['dev', '-p', '3000', '-H', '0.0.0.0'];
const CWD = '/home/z/my-project';

let restartCount = 0;
const MAX_RESTARTS = 5;

function startNext(): void {
  console.log(`[keepalive] starting Next.js (attempt ${restartCount + 1})...`);
  const child = spawn(NEXT_BIN, ARGS, {
    cwd: CWD,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    detached: true,
  });

  // Pipe output to console
  child.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(data);
  });
  child.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data);
  });

  child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    console.log(`[keepalive] Next.js exited (code=${code}, signal=${signal})`);
    if (code !== 0 && restartCount < MAX_RESTARTS) {
      restartCount++;
      console.log(`[keepalive] restarting in 3s...`);
      setTimeout(startNext, 3000);
    } else {
      console.log('[keepalive] giving up');
      process.exit(code ?? 1);
    }
  });

  // Make sure child doesn't keep us alive if we're killed
  process.on('SIGTERM', () => {
    try { process.kill(-child.pid!, 'SIGTERM'); } catch {}
    process.exit(0);
  });
  process.on('SIGINT', () => {
    try { process.kill(-child.pid!, 'SIGTERM'); } catch {}
    process.exit(0);
  });
}

startNext();
