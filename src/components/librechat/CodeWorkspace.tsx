'use client';

/**
 * CodeWorkspace — chat.z.ai-style inline IDE.
 *
 * Appears as a right-side panel when AI generates files via file_write.
 * Features:
 *   - File tree (left) — all files AI created, grouped by directory
 *   - Code view (center) — syntax-highlighted code with tabs per file
 *   - Live preview (right/center) — iframe rendering of HTML/index files
 *   - "Switch to code" / "Switch to preview" toggle (chat.z.ai style)
 *   - Download as zip (jszip)
 *   - "Open in New Tab" — open preview in a new browser tab
 *
 * State: fileWrite events from the chat stream populate this component.
 * Each file_write tool call adds/updates a file in the workspace.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileCode, FileText, FileJson, FileImage, File, Folder, FolderOpen,
  Download, Eye, Code2, ChevronRight, ChevronDown, X, ExternalLink,
  RefreshCw, Copy, Check,
} from 'lucide-react';
import JSZip from 'jszip';
import { useStore } from '@/lib/store';

export interface WorkspaceFile {
  path: string;
  content: string;
  language?: string;
}

interface CodeWorkspaceProps {
  files: WorkspaceFile[];
  onClose: () => void;
}

function getExt(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function getIcon(path: string) {
  const ext = getExt(path);
  switch (ext) {
    case 'js': case 'jsx': case 'ts': case 'tsx': return FileCode;
    case 'json': return FileJson;
    case 'css': case 'scss': return FileCode;
    case 'html': case 'htm': return FileCode;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return FileImage;
    case 'md': case 'txt': case 'log': return FileText;
    default: return File;
  }
}

function getLang(path: string): string {
  const ext = getExt(path);
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', json: 'json', css: 'css', html: 'html', md: 'markdown', txt: 'text',
    sh: 'bash', yml: 'yaml', yaml: 'yaml',
  };
  return map[ext] || 'text';
}

/** Build a nested tree from flat file paths. */
function buildTree(files: WorkspaceFile[]) {
  type TreeNode = { name: string; path: string; isDir: boolean; children?: TreeNode[]; content?: string };
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };

  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      let child = current.children?.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: parts.slice(0, i + 1).join('/'), isDir: !isLast, children: isLast ? undefined : [], content: isLast ? f.content : undefined };
        current.children?.push(child);
      }
      if (!isLast) current = child;
    }
  }

  // Sort: dirs first, then files, alphabetical
  function sort(node: TreeNode) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sort);
  }
  sort(root);
  return root;
}

/** Find the HTML entry point for preview (index.html, or the only HTML file). */
function findHtmlEntry(files: WorkspaceFile[]): string | null {
  const html = files.find((f) => f.path.endsWith('index.html'));
  if (html) return html.path;
  const anyHtml = files.find((f) => f.path.endsWith('.html') || f.path.endsWith('.htm'));
  return anyHtml ? anyHtml.path : null;
}

/** Build a self-contained HTML string for preview (inline CSS/JS). */
function buildPreviewHtml(files: WorkspaceFile[]): string | null {
  const entry = findHtmlEntry(files);
  if (!entry) return null;
  const htmlFile = files.find((f) => f.path === entry);
  if (!htmlFile) return null;
  let html = htmlFile.content;

  // Inline CSS files
  html = html.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (match, cssPath) => {
    const file = files.find((f) => f.path === cssPath || f.path.endsWith('/' + cssPath));
    if (file) return `<style>\n${file.content}\n</style>`;
    return match;
  });

  // Inline JS files
  html = html.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi, (match, jsPath) => {
    const file = files.find((f) => f.path === jsPath || f.path.endsWith('/' + jsPath));
    if (file) return `<script>\n${file.content}\n</script>`;
    return match;
  });

  return html;
}

export default function CodeWorkspace({ files, onClose }: CodeWorkspaceProps) {
  const [mode, setMode] = useState<'code' | 'preview'>('code');
  const [selectedFile, setSelectedFile] = useState<string | null>(files[0]?.path || null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // for refresh
  const openImageLightbox = useStore((s) => s.openImageLightbox);

  const tree = useMemo(() => buildTree(files), [files]);
  const previewHtml = useMemo(() => buildPreviewHtml(files), [files]);
  const canPreview = !!previewHtml;

  // Auto-switch to preview if there's an HTML file
  useEffect(() => {
    if (canPreview && mode === 'code' && files.length > 2) {
      setMode('preview');
    }
  }, [canPreview, files.length]);

  const currentFile = files.find((f) => f.path === selectedFile);

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPreviewInNewTab = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const copyFile = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Render file tree node
  const renderNode = (node: typeof tree, depth = 0): React.ReactNode => {
    if (!node.children) return null;
    return node.children.map((child) => {
      if (child.isDir) {
        const expanded = expandedDirs.has(child.path);
        return (
          <div key={child.path}>
            <button
              onClick={() => toggleDir(child.path)}
              className="hover:bg-surface-nav-hover flex w-full items-center gap-1 py-1 text-start text-xs"
              style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
            >
              {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
              {expanded ? <FolderOpen size={12} className="text-accent-primary shrink-0" /> : <Folder size={12} className="text-accent-primary shrink-0" />}
              <span className="text-text-primary truncate">{child.name}</span>
            </button>
            {expanded && renderNode(child, depth + 1)}
          </div>
        );
      } else {
        const Icon = getIcon(child.path);
        const isActive = selectedFile === child.path;
        return (
          <button
            key={child.path}
            onClick={() => { setSelectedFile(child.path); setMode('code'); }}
            className={`hover:bg-surface-nav-hover flex w-full items-center gap-1 py-1 text-start text-xs ${
              isActive ? 'bg-surface-nav-selected text-text-primary' : 'text-text-secondary'
            }`}
            style={{ paddingInlineStart: `${depth * 12 + 20}px` }}
          >
            <Icon size={12} className="shrink-0" />
            <span className="truncate">{child.name}</span>
          </button>
        );
      }
    });
  };

  return (
    <div className="border-border-light bg-surface-sidebar relative flex h-full w-[480px] shrink-0 flex-col overflow-hidden border-s">
      {/* Header */}
      <div className="border-border-light flex h-[3.25rem] shrink-0 items-center justify-between border-b px-3">
        <div className="text-text-primary flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Code2 size={16} className="text-accent-primary shrink-0" />
          <span className="truncate">Workspace</span>
          <span className="text-text-tertiary text-xs">· {files.length} files</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Code / Preview toggle */}
          <div className="border-border-light bg-surface-search flex items-center gap-0.5 rounded-lg border p-0.5">
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                mode === 'code' ? 'bg-surface-active-alt text-text-primary' : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              <Code2 size={12} /> Code
            </button>
            <button
              onClick={() => canPreview && setMode('preview')}
              disabled={!canPreview}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-30 ${
                mode === 'preview' ? 'bg-surface-active-alt text-text-primary' : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
          {/* Download */}
          <button onClick={downloadZip} title="Download as ZIP" className="hover:bg-surface-nav-hover text-text-secondary hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-lg transition">
            <Download size={14} />
          </button>
          {/* Open in new tab */}
          {canPreview && (
            <button onClick={openPreviewInNewTab} title="Open preview in new tab" className="hover:bg-surface-nav-hover text-text-secondary hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-lg transition">
              <ExternalLink size={14} />
            </button>
          )}
          {/* Close */}
          <button onClick={onClose} aria-label="Close workspace" className="hover:bg-surface-nav-hover text-text-secondary hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-lg transition">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'code' ? (
        <div className="flex min-h-0 flex-1">
          {/* File tree */}
          <div className="border-border-light w-44 shrink-0 overflow-y-auto border-e py-2">
            {renderNode(tree)}
          </div>
          {/* Code view */}
          <div className="min-w-0 flex-1 overflow-auto">
            {currentFile ? (
              <div className="relative h-full">
                {/* File tab bar */}
                <div className="border-border-light bg-surface-code flex items-center gap-2 border-b px-3 py-1.5 text-xs">
                  <span className="text-text-secondary font-mono">{currentFile.path}</span>
                  <span className="text-text-tertiary">· {getLang(currentFile.path)}</span>
                  <button onClick={copyFile} title="Copy" className="text-text-tertiary hover:text-text-primary ms-auto">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                {/* Code content */}
                <pre className="bg-surface-code-body h-[calc(100%-2rem)] overflow-auto p-4">
                  <code className="text-text-primary font-mono text-xs leading-relaxed whitespace-pre">
                    {currentFile.content}
                  </code>
                </pre>
              </div>
            ) : (
              <div className="text-text-tertiary flex h-full items-center justify-center text-sm">
                Select a file from the tree
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Preview mode */
        <div className="flex h-full flex-col">
          <div className="border-border-light bg-surface-code flex items-center gap-2 border-b px-3 py-1.5 text-xs">
            <Eye size={12} className="text-accent-primary" />
            <span className="text-text-secondary">Live Preview</span>
            <button onClick={() => setPreviewKey((k) => k + 1)} title="Refresh preview" className="text-text-tertiary hover:text-text-primary ms-auto">
              <RefreshCw size={12} />
            </button>
          </div>
          {previewHtml ? (
            <iframe
              key={previewKey}
              srcDoc={previewHtml}
              title="Preview"
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            />
          ) : (
            <div className="text-text-tertiary flex h-full items-center justify-center text-sm">
              No HTML file found for preview. Generate an index.html to enable live preview.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
