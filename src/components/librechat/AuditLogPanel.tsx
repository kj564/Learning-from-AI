'use client';

/**
 * AuditLogPanel — observability viewer for the ToolCallAudit log.
 *
 * Shows per-call: tool name, args (truncated), status, duration, retries,
 * truncation flag, error message, approval link, validation error. Collapsible
 * by default; opens as a right-side Sheet.
 *
 * Backed by GET /api/audit (docs/agent/safety_rules.md §5, P0-3).
 */

import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Check, X, AlertTriangle, Shield, Filter } from 'lucide-react';

interface AuditRow {
  id: string;
  conversationId: string | null;
  sessionId: string | null;
  toolName: string;
  args: any;
  status: 'success' | 'failure' | 'denied' | 'invalid' | 'pending';
  durationMs: number;
  retries: number;
  errorMessage: string | null;
  resultTruncated: boolean;
  resultBytes: number;
  approvalId: string | null;
  validationError: any | null;
  createdAt: string;
}

interface AuditResponse {
  summary: {
    total: number;
    success: number;
    failure: number;
    denied: number;
    invalid: number;
    pending: number;
    totalDurationMs: number;
    totalRetries: number;
    truncated: number;
    byTool: Record<string, number>;
  };
  audits: AuditRow[];
}

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  success: { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: Check, label: 'success' },
  failure: { color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: X, label: 'failure' },
  denied: { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Shield, label: 'denied' },
  invalid: { color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', icon: AlertTriangle, label: 'invalid' },
  pending: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Loader2, label: 'pending' },
};

export function AuditLogPanel({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId?: string | null;
}) {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (conversationId) params.set('conversationId', conversationId);
      if (statusFilter) params.set('status', statusFilter);
      if (toolFilter) params.set('tool', toolFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/audit?${params}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error('audit load failed', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, statusFilter, toolFilter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield size={18} /> Tool-call audit log
          </SheetTitle>
          <SheetDescription>
            Every tool call — validated, executed, audited. Filter by status or tool name.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <Input
              placeholder="status: success|failure|denied|invalid"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="tool: web_search, send_email…"
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </Button>
          </div>

          {/* Summary */}
          {data?.summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
              <SummaryCard label="Total" value={data.summary.total} />
              <SummaryCard label="Success" value={data.summary.success} tone="emerald" />
              <SummaryCard label="Failure" value={data.summary.failure} tone="red" />
              <SummaryCard label="Denied" value={data.summary.denied} tone="amber" />
              <SummaryCard label="Invalid" value={data.summary.invalid} tone="purple" />
              <SummaryCard label="Pending" value={data.summary.pending} tone="blue" />
              <SummaryCard label="Retries" value={data.summary.totalRetries} />
              <SummaryCard label="Truncated" value={data.summary.truncated} />
              <SummaryCard label="Total time" value={`${(data.summary.totalDurationMs / 1000).toFixed(1)}s`} />
              <SummaryCard label="By tool" value={Object.keys(data.summary.byTool).length} />
            </div>
          )}

          {/* Rows */}
          <div className="space-y-2">
            {data?.audits.map((row) => {
              const meta = STATUS_META[row.status] || STATUS_META.failure;
              const Icon = meta.icon;
              return (
                <div key={row.id} className="rounded-lg border border-border p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                        <Icon size={11} /> {meta.label}
                      </Badge>
                      <span className="font-mono font-semibold">{row.toolName}</span>
                      {row.retries > 0 && <Badge variant="secondary">retry ×{row.retries}</Badge>}
                      {row.resultTruncated && <Badge variant="secondary">truncated</Badge>}
                      {row.approvalId && <Badge variant="outline" className="gap-1"><Shield size={11} /> approval</Badge>}
                    </div>
                    <span className="text-muted-foreground tabular-nums">{row.durationMs}ms</span>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-mono bg-muted rounded p-2 max-h-32 overflow-y-auto">
                    {JSON.stringify(row.args, null, 2).slice(0, 800)}
                  </pre>
                  {row.errorMessage && (
                    <p className="mt-2 text-red-600 dark:text-red-400">
                      <span className="font-mono">error:</span> {row.errorMessage}
                    </p>
                  )}
                  {row.validationError && (
                    <p className="mt-2 text-purple-600 dark:text-purple-400">
                      <span className="font-mono">validation:</span> {JSON.stringify(row.validationError)}
                    </p>
                  )}
                  <p className="mt-2 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</p>
                </div>
              );
            })}
            {data && data.audits.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No tool calls recorded yet.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' | 'red' | 'amber' | 'purple' | 'blue' }) {
  const toneClass = tone ? {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
    blue: 'text-blue-600 dark:text-blue-400',
  }[tone] : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
