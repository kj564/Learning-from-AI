'use client';

/**
 * Code block with chat.z.ai / bolt.diy-style artifact actions:
 *   - Header: language label + Copy + Download + Run (for executable languages)
 *   - Run: POST /api/tools { code_run } → show stdout/stderr inline below
 *   - Edit: toggle inline edit mode (textarea), Save → re-render
 */

import { useState, useEffect } from 'react';
import { Check, Copy, Download, Play, Pencil, Save, X, Loader2 } from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript',
  tsx: 'TypeScript', typescript: 'TypeScript', py: 'Python', python: 'Python',
  bash: 'Bash', sh: 'Bash', shell: 'Bash', json: 'JSON', css: 'CSS', html: 'HTML',
  md: 'Markdown', markdown: 'Markdown', sql: 'SQL', go: 'Go', rust: 'Rust',
  java: 'Java', c: 'C', cpp: 'C++', 'c++': 'C++', cs: 'C#', csharp: 'C#',
  php: 'PHP', ruby: 'Ruby', yml: 'YAML', yaml: 'YAML', xml: 'XML',
};

const RUNNABLE_LANGS = new Set(['javascript', 'typescript', 'python', 'bash', 'sh']);

function langLabel(lang: string): string {
  if (!lang) return 'Code';
  return LANG_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}

function isRunnable(lang?: string): boolean {
  return !!lang && RUNNABLE_LANGS.has(lang.toLowerCase());
}

export default function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout?: string; stderr?: string; error?: string } | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editing ? draft : code);
      setCopied(true);
    } catch { /* ignore */ }
  };

  const download = () => {
    const content = editing ? draft : code;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${(language || 'txt').toLowerCase()}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const run = async () => {
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'code_run',
          args: {
            code: editing ? draft : code,
            language: (language || 'javascript').toLowerCase(),
          },
        }),
      });
      const data = await res.json();
      setOutput({
        stdout: data.stdout,
        stderr: data.stderr,
        error: data.error || (data.success === false ? 'Execution failed' : undefined),
      });
    } catch (e) {
      setOutput({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  const saveEdit = () => {
    // Update the parent code via a custom event (CodeBlock is a leaf component,
    // so we use a global event bus for the Markdown renderer to pick up).
    // For simplicity in this prototype, we just update local state and the
    // user can copy the edited code out. (Full edit→re-render requires
    // teaching Markdown to swap content.)
    setEditing(false);
    // No-op: draft is preserved if user re-opens edit mode.
  };

  return (
    <div className="border-border-light bg-surface-code my-3 overflow-hidden rounded-xl border text-xs">
      {/* Code bar */}
      <div className="text-text-secondary flex items-center justify-between bg-surface-code px-2 py-1.5 font-sans">
        <span className="font-medium">{langLabel(language || '')}</span>
        <div className="flex items-center gap-0.5">
          {isRunnable(language) && (
            <button
              onClick={run}
              disabled={running}
              title="Run code"
              className="text-status-success hover:bg-surface-active flex items-center gap-1 rounded px-1.5 py-0.5 transition disabled:opacity-50"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              <span className="text-[11px]">Run</span>
            </button>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            title={editing ? 'Exit edit' : 'Edit code'}
            className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 transition"
          >
            {editing ? <X size={12} /> : <Pencil size={12} />}
          </button>
          <button
            onClick={download}
            title="Download"
            className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 transition"
          >
            <Download size={12} />
          </button>
          <button
            onClick={copy}
            title={copied ? 'Copied!' : 'Copy'}
            className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 transition"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      {/* Body */}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(20, Math.max(4, draft.split('\n').length))}
          className="bg-surface-code-body text-text-primary w-full resize-y px-3 py-2 font-mono text-xs outline-none"
          autoFocus
        />
      ) : (
        <pre className="bg-surface-code-body overflow-x-auto p-4">
          <code className={`hljs language-${language || ''} !whitespace-pre font-mono`}>{draft}</code>
        </pre>
      )}
      {/* Run output */}
      {output && (
        <div className="border-border-light border-t">
          <div className="text-text-tertiary bg-surface-code px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
            Output
          </div>
          {output.stdout && (
            <pre className="text-text-primary bg-surface-code-body overflow-x-auto px-3 py-2 font-mono text-[11px]">{output.stdout}</pre>
          )}
          {(output.stderr || output.error) && (
            <pre className="text-status-error bg-surface-code-body overflow-x-auto px-3 py-2 font-mono text-[11px]">
              {output.stderr || output.error}
            </pre>
          )}
          {!output.stdout && !output.stderr && !output.error && (
            <pre className="text-text-tertiary bg-surface-code-body px-3 py-2 font-mono text-[11px] italic">(no output)</pre>
          )}
        </div>
      )}
    </div>
  );
}
