'use client';

/**
 * CodeExecutionOutput — renders the stdout/stderr from a code_run or shell_run tool result.
 *
 * Parses the tool's `result` string (JSON-encoded) and shows:
 *   - Success/fail badge
 *   - stdout (in a code block, scrollable)
 *   - stderr (in a code block with error styling, scrollable)
 *   - Exit code if present
 */

import { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface CodeExecutionOutputProps {
  tool: string;
  result: string;
}

export default function CodeExecutionOutput({ tool, result }: CodeExecutionOutputProps) {
  const [expanded, setExpanded] = useState(true);

  let parsed: any = null;
  try {
    parsed = JSON.parse(result);
  } catch {
    // not JSON — show raw
  }

  const stdout = parsed?.stdout || '';
  const stderr = parsed?.stderr || '';
  const error = parsed?.error || '';
  const hasOutput = stdout || stderr || error;

  if (!hasOutput) return null;

  const failed = !!error || (parsed?.success === false);

  return (
    <div className={`border ${failed ? 'border-status-error/40' : 'border-border-light'} bg-surface-code-body overflow-hidden rounded-md text-xs`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-start ${failed ? 'text-status-error' : 'text-text-secondary'}`}
      >
        <Terminal size={12} className="shrink-0" />
        <span className="font-mono">{tool} output</span>
        {failed && <span className="text-status-error">(failed)</span>}
        {expanded ? <ChevronUp size={12} className="ms-auto" /> : <ChevronDown size={12} className="ms-auto" />}
      </button>
      {expanded && (
        <div className="border-border-light border-t">
          {stdout && (
            <pre className="text-text-primary overflow-x-auto px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {stdout}
            </pre>
          )}
          {stderr && (
            <pre className="text-status-error border-border-light overflow-x-auto border-t px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {stderr}
            </pre>
          )}
          {error && !stderr && (
            <pre className="text-status-error border-border-light overflow-x-auto border-t px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
