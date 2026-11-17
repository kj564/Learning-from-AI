'use client';

/**
 * Code block with LibreChat-style header bar: language icon, copy, download.
 * Used by the Markdown renderer for fenced code blocks.
 */

import { useState, useEffect } from 'react';
import { Check, Copy, Download } from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript',
  tsx: 'TypeScript', typescript: 'TypeScript', py: 'Python', python: 'Python',
  bash: 'Bash', sh: 'Bash', shell: 'Bash', json: 'JSON', css: 'CSS', html: 'HTML',
  md: 'Markdown', markdown: 'Markdown', sql: 'SQL', go: 'Go', rust: 'Rust',
  java: 'Java', c: 'C', cpp: 'C++', 'c++': 'C++', cs: 'C#', csharp: 'C#',
  php: 'PHP', ruby: 'Ruby', yml: 'YAML', yaml: 'YAML', xml: 'XML',
};

function langLabel(lang: string): string {
  if (!lang) return 'Code';
  return LANG_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}

export default function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-border-light bg-surface-code my-3 overflow-hidden rounded-xl border text-xs">
      {/* Code bar */}
      <div className="text-text-secondary flex items-center justify-between bg-surface-code px-2 py-1.5 font-sans">
        <span className="font-medium">{langLabel(language || '')}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={download}
            title="Download"
            className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 transition"
          >
            <Download size={14} />
          </button>
          <button
            onClick={copy}
            title={copied ? 'Copied!' : 'Copy'}
            className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 transition"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      {/* Body */}
      <pre className="bg-surface-code-body overflow-x-auto p-4">
        <code className={`hljs language-${language || ''} !whitespace-pre font-mono`}>{code}</code>
      </pre>
    </div>
  );
}
