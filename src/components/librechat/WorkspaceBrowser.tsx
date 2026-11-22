'use client';

/**
 * WorkspaceBrowser — a chat.z.ai-style file browser for the agent workspace.
 *
 * Layout:
 *   - Top: workspace selector dropdown + breadcrumb path + toolbar (Upload, Refresh)
 *   - Main: file/folder list. Click a folder to navigate into it; click a file
 *     to open the preview pane (replaces the list; "Back to files" returns).
 *
 * Preview renderers (by MIME):
 *   - text/markdown → Markdown component (rendered)
 *   - text/*, application/json → CodeBlock with syntax highlighting
 *   - image/* → <img src={rawUrl}>
 *   - application/pdf → <iframe src={rawUrl}>
 *   - other binary → download link
 *   - quarantined files → blocked view with the quarantine reason
 *
 * Upload: multipart POST to /api/workspaces/[id]/files. The backend runs
 * MIME sniffing + blocklist scan and may quarantine (T27, T28). A toast
 * reports the outcome. Uploaded files appear immediately in the list.
 *
 * The active workspace is resolved from the page's activeConversationId
 * (workspaces are named `conversation:<convoId>`). If none exists, the
 * user can create one or pick from the list.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, RefreshCw, Upload, Folder, FileText, FileCode, FileImage, File as FileIcon,
  ChevronRight, ChevronLeft, Home, FolderPlus, ShieldAlert, Download, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from '@/components/librechat/Markdown';
import CodeBlock from '@/components/librechat/CodeBlock';

interface WorkspaceInfo {
  id: string;
  name: string;
  userId: string;
  projectId: string | null;
  fileCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface ListEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  modified: string;
}

interface FileContent {
  path: string;
  content: string;
  isBinary: boolean;
  mimeType: string;
  sniffedMime: string;
  size: number;
  modified: string;
  status: string;
  rawUrl: string;
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  READY: { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'ready' },
  INDEXED: { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'indexed' },
  UPLOADED: { color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', label: 'uploaded' },
  SCANNING: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'scanning' },
  QUARANTINED: { color: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'quarantined' },
  DELETED: { color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', label: 'deleted' },
};

function iconFor(name: string, type: 'file' | 'dir', mime?: string) {
  if (type === 'dir') return <Folder size={16} className="text-amber-500 shrink-0" />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return <FileImage size={16} className="text-purple-500 shrink-0" />;
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'sh', 'rb', 'go', 'rs', 'java', 'json', 'yaml', 'yml', 'toml', 'html', 'css', 'xml'].includes(ext)) return <FileCode size={16} className="text-blue-500 shrink-0" />;
  if (['md', 'txt', 'csv', 'tsv'].includes(ext)) return <FileText size={16} className="text-emerald-500 shrink-0" />;
  return <FileIcon size={16} className="text-slate-500 shrink-0" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function languageFor(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', sh: 'bash', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    html: 'html', css: 'css', xml: 'xml', md: 'markdown', sql: 'sql',
  };
  return ext ? map[ext] : undefined;
}

export function WorkspaceBrowser({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId?: string | null;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load workspace list on open.
  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      // Auto-pick the active conversation's workspace, or the most recent.
      const convoWs = (data.workspaces || []).find((w: WorkspaceInfo) => w.name === `conversation:${conversationId}`);
      if (convoWs) {
        setActiveWsId(convoWs.id);
      } else if (data.workspaces?.length > 0 && !activeWsId) {
        setActiveWsId(data.workspaces[0].id);
      }
    } catch (e) {
      console.error('load workspaces failed', e);
    }
  }, [conversationId, activeWsId]);

  // Load the current directory listing.
  const loadDir = useCallback(async () => {
    if (!activeWsId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWsId}/files?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
      else if (data.error) toast.error(`List failed: ${data.error}`);
    } catch (e) {
      toast.error(`List failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [activeWsId, currentPath]);

  useEffect(() => {
    if (open) {
      loadWorkspaces();
      setSelectedFile(null);
    }
  }, [open, loadWorkspaces]);

  // Reset to root when the active workspace changes (user picks a different
  // workspace from the dropdown). Deliberately does NOT depend on loadDir —
  // loadDir changes when currentPath changes, which would reset currentPath
  // back to "." and make folder navigation impossible.
  useEffect(() => {
    if (open && activeWsId) {
      setCurrentPath('.');
      setSelectedFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWsId]);

  useEffect(() => {
    if (open && activeWsId) loadDir();
  }, [currentPath, open, activeWsId, loadDir]);

  // Open a file → fetch its content for preview.
  async function openFile(entry: ListEntry) {
    if (entry.type !== 'file') return;
    setLoadingFile(true);
    setSelectedFile(null);
    try {
      const res = await fetch(`/api/workspaces/${activeWsId}/file?path=${encodeURIComponent(entry.path)}&format=json`);
      const data = await res.json();
      if (res.ok) {
        setSelectedFile(data);
      } else {
        toast.error(`Cannot open: ${data.error || 'unknown'}`);
      }
    } catch (e) {
      toast.error(`Open failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingFile(false);
    }
  }

  // Upload a file from the user's computer.
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeWsId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath === '.' ? `input/${file.name}` : `${currentPath}/${file.name}`);
    try {
      const res = await fetch(`/api/workspaces/${activeWsId}/files`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Uploaded ${file.name}`, {
          description: `${formatSize(data.size)}${data.sniffedMime ? ` · ${data.sniffedMime}` : ''}`,
        });
        loadDir();
      } else if (data.quarantined) {
        toast.error(`Quarantined: ${file.name}`, {
          description: data.quarantineReason || 'failed scan',
          duration: 8000,
        });
        loadDir();
      } else {
        toast.error(`Upload failed: ${data.error || 'unknown'}`);
      }
    } catch (e) {
      toast.error(`Upload error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Create a new workspace (for the active conversation if none exists).
  async function createWorkspace() {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: conversationId ? `conversation:${conversationId}` : `manual-${Date.now()}` }),
      });
      const data = await res.json();
      if (data.id) {
        setActiveWsId(data.id);
        await loadWorkspaces();
        toast.success('Workspace created');
      }
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Breadcrumb segments from currentPath.
  const breadcrumbs = currentPath === '.' ? [] : currentPath.split('/').filter(Boolean);

  // Navigate to a breadcrumb index.
  function navigateTo(index: number | null) {
    if (index === null) {
      setCurrentPath('.');
    } else {
      setCurrentPath(breadcrumbs.slice(0, index + 1).join('/'));
    }
    setSelectedFile(null);
  }

  // Navigate into a folder.
  function openFolder(entry: ListEntry) {
    setCurrentPath(entry.path);
    setSelectedFile(null);
  }

  const activeWs = workspaces.find((w) => w.id === activeWsId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Folder size={18} /> Workspace files
          </SheetTitle>
          <SheetDescription>
            Browse, preview, and upload files in the agent's isolated workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Workspace selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowWorkspacePicker((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Folder size={12} />
              {activeWs ? activeWs.name : 'no workspace'}
              <ChevronRight size={12} className={showWorkspacePicker ? 'rotate-90' : ''} />
            </button>
            {showWorkspacePicker && (
              <select
                value={activeWsId || ''}
                onChange={(e) => { setActiveWsId(e.target.value); setShowWorkspacePicker(false); }}
                className="text-xs rounded-md border border-border px-2 py-1 bg-background"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" variant="outline" onClick={createWorkspace}>
              <FolderPlus size={12} className="mr-1" /> New
            </Button>
          </div>

          {!activeWsId ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Folder size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                No workspace yet. Create one to start uploading files, or the agent
                will auto-create one on your next file-related request.
              </p>
              <Button size="sm" onClick={createWorkspace}>
                <FolderPlus size={14} className="mr-1" /> Create workspace
              </Button>
            </div>
          ) : selectedFile ? (
            /* === Preview pane === */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={() => setSelectedFile(null)}>
                  <ChevronLeft size={14} className="mr-1" /> Back to files
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">{formatSize(selectedFile.size)}</Badge>
                  <Badge variant="outline" className="text-[11px]">{selectedFile.mimeType}</Badge>
                  <a href={selectedFile.rawUrl} download={selectedFile.path.split('/').pop()}>
                    <Button size="sm" variant="outline">
                      <Download size={12} className="mr-1" /> Download
                    </Button>
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <FilePreview file={selectedFile} />
              </div>
            </div>
          ) : (
            /* === File/folder list === */
            <div className="space-y-3">
              {/* Breadcrumb + toolbar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs overflow-x-auto flex-1 min-w-0">
                  <button onClick={() => navigateTo(null)} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted shrink-0">
                    <Home size={12} /> root
                  </button>
                  {breadcrumbs.map((seg, i) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      <ChevronRight size={10} className="text-muted-foreground" />
                      <button onClick={() => navigateTo(i)} className="px-1.5 py-1 rounded hover:bg-muted">
                        {seg}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={12} className="mr-1" /> Upload
                  </Button>
                  <Button size="sm" variant="ghost" onClick={loadDir} disabled={loading}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </Button>
                </div>
              </div>

              {/* Entries */}
              {loading && entries.length === 0 ? (
                <div className="text-center py-12">
                  <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <FileIcon size={28} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    This folder is empty. Upload a file or ask the agent to write one here.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <button
                      key={entry.path}
                      onClick={() => entry.type === 'dir' ? openFolder(entry) : openFile(entry)}
                      className="w-full flex items-center gap-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 px-3 py-2 text-left transition-colors"
                    >
                      {iconFor(entry.name, entry.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{entry.name}</div>
                        {entry.type === 'file' && (
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {formatSize(entry.size)} · {new Date(entry.modified).toLocaleString()}
                          </div>
                        )}
                      </div>
                      {entry.type === 'file' && loadingFile && (
                        <Loader2 size={12} className="animate-spin text-muted-foreground" />
                      )}
                      {entry.type === 'dir' && (
                        <ChevronRight size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilePreview({ file }: { file: FileContent }) {
  const isMarkdown = file.mimeType === 'text/markdown' || file.path.endsWith('.md');
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const isCode = !isImage && !isPdf && !isMarkdown;
  const lang = languageFor(file.path);

  // Quarantined files: block the preview.
  if (file.status === 'QUARANTINED') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
        <ShieldAlert size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="text-sm text-red-800 dark:text-red-300">
          <strong>File quarantined.</strong> This file failed the security scan and
          cannot be previewed. Reason: <code className="font-mono">{file.mimeType}</code>{' '}
          (detected by magic-byte sniffing, not the file extension). The agent also
          cannot read this file via <code>read_file</code>.
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="space-y-2">
        <img src={file.rawUrl} alt={file.path} className="max-w-full rounded-md border border-border" />
        <p className="text-xs text-muted-foreground">{file.path}</p>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="space-y-2">
        <iframe src={file.rawUrl} className="w-full h-[60vh] rounded-md border border-border" title={file.path} />
        <p className="text-xs text-muted-foreground">PDF preview · {file.path}</p>
      </div>
    );
  }

  if (isMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <Markdown content={file.content} />
      </div>
    );
  }

  if (isCode && file.content) {
    return <CodeBlock code={file.content} language={lang} />;
  }

  // Plain text or unknown text type.
  if (!file.isBinary && file.content) {
    return (
      <pre className="whitespace-pre-wrap text-xs font-mono bg-muted rounded-md p-3 max-h-[60vh] overflow-y-auto">
        {file.content}
      </pre>
    );
  }

  // Binary, non-previewable.
  return (
    <div className="text-center py-8">
      <FileIcon size={32} className="mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Binary file ({file.mimeType}) — no inline preview.
      </p>
      <a href={file.rawUrl} download={file.path.split('/').pop()}>
        <Button size="sm" variant="outline">
          <Download size={14} className="mr-1" /> Download
        </Button>
      </a>
    </div>
  );
}
