'use client';

/**
 * SandboxPanel — dashboard for the sandbox worker mini-service.
 *
 * Shows:
 *   - Worker health (tier, limits, jobs processed) — polls /api/sandbox/health.
 *   - Recent sandbox jobs (from /api/sandbox/jobs) with status, isolation
 *     tier, tool name, args, stdout/stderr, exit code, duration.
 *   - A "Run test job" button that enqueues a harmless sandbox job so you
 *     can verify the worker is alive end-to-end from the UI.
 *
 * The honest isolation-tier warning is surfaced inline: if the worker is
 * running the "process" tier, a yellow banner explains it's dev-only and
 * not OS-level isolation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Play, AlertTriangle, Check, X, Clock, Cpu, Terminal, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface WorkerHealth {
  ok: boolean;
  tier: 'docker' | 'process' | 'unreachable';
  limits?: {
    timeoutMs: number;
    maxBufferBytes: number;
    maxProcesses: number;
    memoryLimitMb: number;
    cpuLimit: string;
  };
  jobs?: number;
}

interface SandboxJobRow {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  toolName: 'run_code_sandbox' | 'run_shell';
  args: any;
  status: 'QUEUED' | 'RUNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  isolationTier: 'docker' | 'process';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  limits: any;
  createdAt: string;
}

interface JobsResponse {
  summary: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    timeout: number;
    cancelled: number;
    byTier: Record<string, number>;
  };
  jobs: SandboxJobRow[];
}

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  QUEUED: { color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', icon: Clock, label: 'queued' },
  RUNNING: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Loader2, label: 'running' },
  COMPLETED: { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: Check, label: 'completed' },
  FAILED: { color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: X, label: 'failed' },
  TIMEOUT: { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Clock, label: 'timeout' },
  CANCELLED: { color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', icon: X, label: 'cancelled' },
};

export function SandboxPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<SandboxJobRow | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, j] = await Promise.all([
        fetch('/api/sandbox/health').then((r) => r.json()),
        fetch('/api/sandbox/jobs?limit=50').then((r) => r.json()),
      ]);
      setHealth(h);
      setJobs(j);
    } catch (e) {
      console.error('sandbox panel load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Auto-refresh every 5s while open (job statuses change quickly).
  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [open, load]);

  async function runTestJob() {
    setTesting(true);
    try {
      // Create a workspace for the test if none exists.
      const wsResp = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `sandbox-test-${Date.now()}` }),
      });
      const ws = await wsResp.json();
      const workspaceId = ws.id;
      // Enqueue a harmless test job.
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'run_code_sandbox',
          args: {
            workspaceId,
            language: 'javascript',
            code: `console.log('sandbox test at', new Date().toISOString()); console.log('cwd:', process.cwd()); console.log('SANDBOX env:', process.env.SANDBOX); console.log('WORKSPACE env:', process.env.WORKSPACE);`,
          },
          conversationId: `sandbox-test-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Test job completed', { description: `tier: ${data.isolationTier}, exit: ${data.exitCode}` });
      } else {
        toast.error(`Test job failed: ${data.error || data.message}`);
      }
      // Refresh the job list.
      setTimeout(load, 500);
    } catch (e) {
      toast.error(`Test job error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Terminal size={18} /> Sandbox worker
          </SheetTitle>
          <SheetDescription>
            Code execution service (port 3030). Runs <code>run_code_sandbox</code> and{' '}
            <code>run_shell</code> jobs in an isolated process.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Worker health card */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Cpu size={14} /> Worker status
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={runTestJob} disabled={testing || !health?.ok}>
                  {testing ? <Loader2 size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
                  Run test job
                </Button>
                <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </Button>
              </div>
            </div>

            {health?.ok ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={health.tier === 'docker' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}>
                    tier: {health.tier}
                  </Badge>
                  <Badge variant="secondary">jobs processed: {health.jobs ?? 0}</Badge>
                  {health.limits && (
                    <>
                      <Badge variant="outline">timeout: {health.limits.timeoutMs / 1000}s</Badge>
                      <Badge variant="outline">mem: {health.limits.memoryLimitMb}MB</Badge>
                      <Badge variant="outline">cpu: {health.limits.cpuLimit}</Badge>
                      <Badge variant="outline">max procs: {health.limits.maxProcesses}</Badge>
                      <Badge variant="outline">output: {(health.limits.maxBufferBytes / 1024).toFixed(0)}KB</Badge>
                    </>
                  )}
                </div>
                {health.tier === 'process' && (
                  <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Process tier (dev-only).</strong> Not OS-level isolation. A
                      determined adversary running untrusted code could read world-readable
                      host files, make outbound network requests, or exhaust resources until
                      the timeout. For untrusted code, deploy the <code>docker</code> tier
                      (worker auto-detects Docker at boot) — see{' '}
                      <code>docs/agent/safety_rules.md §10</code>.
                    </div>
                  </div>
                )}
                {health.tier === 'docker' && (
                  <div className="mt-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-2 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
                    <Check size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Docker tier.</strong> Jobs run in isolated containers with{' '}
                      <code>--network none --read-only --memory 512m --cpus 1 --pids-limit 16 --user nobody --cap-drop ALL</code>.
                      Safe for untrusted code.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2 text-xs text-red-800 dark:text-red-300 flex gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Worker unreachable.</strong> The sandbox worker (port 3030) is not
                  running. <code>run_code_sandbox</code> and <code>run_shell</code> will fail
                  with <code>SANDBOX_WORKER_UNREACHABLE</code>. Start it:
                  <pre className="mt-1 p-2 bg-red-100 dark:bg-red-900/40 rounded text-[11px] font-mono overflow-x-auto">cd mini-services/sandbox-worker && bun run dev</pre>
                </div>
              </div>
            )}
          </div>

          {/* Job summary */}
          {jobs?.summary && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 text-xs">
              <SummaryCard label="Total" value={jobs.summary.total} />
              <SummaryCard label="Completed" value={jobs.summary.completed} tone="emerald" />
              <SummaryCard label="Failed" value={jobs.summary.failed} tone="red" />
              <SummaryCard label="Timeout" value={jobs.summary.timeout} tone="amber" />
              <SummaryCard label="Running" value={jobs.summary.running} tone="blue" />
              <SummaryCard label="Queued" value={jobs.summary.queued} tone="slate" />
            </div>
          )}

          {/* Job list */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Recent jobs</h3>
            {jobs?.jobs.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No sandbox jobs yet. Click "Run test job" to verify the worker.
              </p>
            )}
            {jobs?.jobs.map((job) => {
              const meta = STATUS_META[job.status] || STATUS_META.FAILED;
              const Icon = meta.icon;
              const duration = job.startedAt && job.finishedAt
                ? new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()
                : null;
              const isSelected = selectedJob?.id === job.id;
              return (
                <div key={job.id} className="rounded-lg border border-border p-3 text-xs">
                  <button
                    onClick={() => setSelectedJob(isSelected ? null : job)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                          <Icon size={11} className={job.status === 'RUNNING' ? 'animate-spin' : ''} /> {meta.label}
                        </Badge>
                        <span className="font-mono font-semibold">{job.toolName}</span>
                        <Badge variant="secondary" className={job.isolationTier === 'docker' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}>
                          {job.isolationTier}
                        </Badge>
                        {job.exitCode !== null && (
                          <Badge variant={job.exitCode === 0 ? 'secondary' : 'destructive'}>
                            exit {job.exitCode}
                          </Badge>
                        )}
                        {duration !== null && (
                          <Badge variant="outline" className="tabular-nums">{duration}ms</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-muted-foreground">args:</span>{' '}
                      <code className="font-mono text-[11px] bg-muted rounded px-1">
                        {job.toolName === 'run_code_sandbox'
                          ? `${job.args.language || 'javascript'}: ${(job.args.code || '').slice(0, 60)}${(job.args.code || '').length > 60 ? '…' : ''}`
                          : `$ ${(job.args.command || '').slice(0, 60)}${(job.args.command || '').length > 60 ? '…' : ''}`}
                      </code>
                    </div>
                  </button>
                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-3 space-y-2 border-t border-border pt-2">
                      <div>
                        <div className="text-muted-foreground text-[11px] mb-1">stdout</div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/20 rounded p-2 max-h-48 overflow-y-auto">
                          {job.stdout || '(empty)'}
                        </pre>
                      </div>
                      {(job.stderr || job.errorMessage) && (
                        <div>
                          <div className="text-muted-foreground text-[11px] mb-1">stderr / error</div>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] bg-red-50 dark:bg-red-950/20 rounded p-2 max-h-48 overflow-y-auto">
                            {job.errorMessage ? `error: ${job.errorMessage}\n\n${job.stderr}` : job.stderr}
                          </pre>
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        <div>workspace: <code className="font-mono">{job.workspaceId}</code></div>
                        <div>job id: <code className="font-mono">{job.id}</code></div>
                        {job.startedAt && <div>started: {new Date(job.startedAt).toLocaleString()}</div>}
                        {job.finishedAt && <div>finished: {new Date(job.finishedAt).toLocaleString()}</div>}
                        {job.limits && (
                          <div>
                            limits: timeout {job.limits.timeoutMs}ms, mem {job.limits.memoryLimitMb}MB, cpu {job.limits.cpuLimit}, maxprocs {job.limits.maxProcesses}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' | 'red' | 'amber' | 'blue' | 'slate' }) {
  const toneClass = tone ? {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    slate: 'text-slate-600 dark:text-slate-400',
  }[tone] : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
