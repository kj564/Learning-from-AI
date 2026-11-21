'use client';

/**
 * ApprovalDialog — surfaces a pending dangerous-tool action (currently email)
 * to the user with Approve / Edit / Reject buttons.
 *
 * Flow (see docs/agent/safety_rules.md §2.7, evaluation_tests.md T1-T4):
 *   - The chat stream emits an `approval_required` SSE event with {approvalId,
 *     token, draft, expiresAt}.
 *   - The page renders this dialog and stores the token in component state
 *     (never persisted to localStorage — single-use, in-memory only).
 *   - User clicks Approve  → POST /api/approvals/[id]/approve {token}
 *   - User clicks Reject   → POST /api/approvals/[id]/reject {token}
 *   - User edits + saves   → POST /api/approvals/[id]/edit {token, args}
 *     → returns a NEW approvalId + token; the old token is invalidated (T4).
 *
 * The model never sees the token. The model setting `confirmed:true` does
 * not authorize a send (T1).
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, ShieldAlert, Clock, Check, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export interface PendingApproval {
  approvalId: string;
  token: string;
  tool: string;
  draft: Record<string, unknown>;
  expiresAt: string;
  message?: string;
}

export function ApprovalDialog({
  approval,
  onClose,
  onResolved,
}: {
  approval: PendingApproval | null;
  onClose: () => void;
  onResolved?: (status: 'COMPLETED' | 'REJECTED' | 'FAILED' | 'EXPIRED', detail?: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | 'edit' | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (approval) {
      setDraft(approval.draft);
      setEditing(false);
    }
  }, [approval]);

  // Countdown to expiry (T3)
  useEffect(() => {
    if (!approval) return;
    const tick = () => {
      const ms = new Date(approval.expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
      if (ms <= 0) {
        onResolved?.('EXPIRED');
        onClose();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [approval, onClose, onResolved]);

  if (!approval) return null;

  const isEmail = approval.tool === 'send_email_with_approval';
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const expired = remaining <= 0;

  async function callApprove() {
    setBusy('approve');
    try {
      const res = await fetch(`/api/approvals/${approval!.approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: approval!.token }),
      });
      const data = await res.json();
      if (data.ok || data.status === 'COMPLETED') {
        toast.success('Action approved and executed');
        onResolved?.('COMPLETED', data.result);
      } else {
        toast.error(`Approval failed: ${data.error || data.message || 'unknown'}`);
        onResolved?.('FAILED', data);
      }
    } catch (e) {
      toast.error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      onResolved?.('FAILED', { error: String(e) });
    } finally {
      setBusy(null);
      onClose();
    }
  }

  async function callReject() {
    setBusy('reject');
    try {
      const res = await fetch(`/api/approvals/${approval!.approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: approval!.token }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Action rejected');
        onResolved?.('REJECTED');
      } else {
        toast.error(`Reject failed: ${data.error || data.message || 'unknown'}`);
      }
    } catch (e) {
      toast.error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
      onClose();
    }
  }

  async function callEdit() {
    setBusy('edit');
    try {
      const res = await fetch(`/api/approvals/${approval!.approvalId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: approval!.token, args: draft }),
      });
      const data = await res.json();
      if (data.approvalId) {
        // Old approval superseded, new one created. Replace the current
        // approval in-place with the new id/token (T4).
        toast.success('Draft updated — please review and approve');
        approval!.approvalId = data.approvalId;
        approval!.token = data.token;
        approval!.expiresAt = data.expiresAt;
        approval!.draft = draft;
        setEditing(false);
      } else {
        toast.error(`Edit failed: ${data.error || 'unknown'}`);
      }
    } catch (e) {
      toast.error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={!!approval} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600" />
            Approval required
          </DialogTitle>
          <DialogDescription>
            The agent wants to perform a <strong>{approval.tool}</strong> action. This is
            irreversible once executed. Review the draft below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Mail size={12} /> {isEmail ? 'Email' : approval.tool}
            </Badge>
            <Badge variant={expired ? 'destructive' : 'secondary'} className="gap-1">
              <Clock size={12} /> {expired ? 'expired' : `${mins}:${secs.toString().padStart(2, '0')}`}
            </Badge>
          </div>

          {isEmail ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <div>
                <label className="text-xs font-medium text-muted-foreground">To</label>
                {editing ? (
                  <Input
                    value={(draft.to as string) || ''}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm font-mono">{draft.to as string}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                {editing ? (
                  <Input
                    value={(draft.subject as string) || ''}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">{draft.subject as string}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body</label>
                {editing ? (
                  <Textarea
                    value={(draft.body as string) || ''}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="mt-1 min-h-24"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-white dark:bg-zinc-900 rounded p-2 max-h-48 overflow-y-auto">
                    {draft.body as string}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-xs font-mono bg-muted rounded p-2 max-h-48 overflow-y-auto">
              {JSON.stringify(draft, null, 2)}
            </pre>
          )}

          <p className="text-xs text-muted-foreground">
            {approval.message || 'Click Approve to execute, Edit to revise, or Reject to cancel.'}
          </p>
        </div>

        <DialogFooter className="gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => { setEditing(false); setDraft(approval.draft); }}
                disabled={!!busy || expired}
              >
                Cancel edit
              </Button>
              <Button onClick={callEdit} disabled={!!busy || expired}>
                {busy === 'edit' ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Pencil size={14} className="mr-1" />}
                Save draft
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} disabled={!!busy || expired}>
                <Pencil size={14} className="mr-1" /> Edit
              </Button>
              <Button variant="destructive" onClick={callReject} disabled={!!busy || expired}>
                {busy === 'reject' ? <Loader2 size={14} className="mr-1 animate-spin" /> : <X size={14} className="mr-1" />}
                Reject
              </Button>
              <Button onClick={callApprove} disabled={!!busy || expired}>
                {busy === 'approve' ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
                Approve &amp; send
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
