'use client';

/**
 * Right-side documents panel — LibreChat-style "Side panel" for project context.
 *
 *   - 320px wide on desktop, full-screen overlay on mobile
 *   - Project name (editable), description, instructions (textarea)
 *   - Documents list with inline edit + delete
 *   - Add document button
 *
 * All changes are persisted via the existing /api/projects endpoints.
 */

import { useEffect, useState, useCallback } from 'react';
import { X, Plus, FileText, Code, Settings2, FileCog, Trash2, Save, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Project, ProjectDocument } from '@/lib/api';
import {
  updateProject, addDocument, updateDocument, deleteDocument, getProject,
} from '@/lib/api';

const TYPE_ICONS = {
  code: Code,
  text: FileText,
  instruction: Settings2,
  config: FileCog,
} as const;

const TYPE_LABELS = {
  code: 'Code',
  text: 'Text',
  instruction: 'Instructions',
  config: 'Config',
} as const;

export default function DocumentsPanel() {
  const isMobile = useStore((s) => s.isMobile);
  const activeProject = useStore((s) => s.activeProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const setShowDocumentsPanel = useStore((s) => s.setShowDocumentsPanel);
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);

  // Local editable copies
  const [name, setName] = useState(activeProject?.name ?? '');
  const [description, setDescription] = useState(activeProject?.description ?? '');
  const [instructions, setInstructions] = useState(activeProject?.instructions ?? '');
  const [docs, setDocs] = useState<ProjectDocument[]>(activeProject?.documents ?? []);
  const [saving, setSaving] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [draftDoc, setDraftDoc] = useState<ProjectDocument | null>(null);

  // Sync when active project changes
  useEffect(() => {
    setName(activeProject?.name ?? '');
    setDescription(activeProject?.description ?? '');
    setInstructions(activeProject?.instructions ?? '');
    setDocs(activeProject?.documents ?? []);
    setEditingDocId(null);
    setDraftDoc(null);
  }, [activeProject?.id]);

  const refreshProject = useCallback(async (id: string) => {
    const full = await getProject(id);
    if (full) {
      setActiveProject(full);
      setProjects(projects.map((p) => (p.id === id ? full : p)));
    }
  }, [activeProject, projects, setActiveProject, setProjects]);

  const saveProjectMeta = async () => {
    if (!activeProject) return;
    setSaving(true);
    const updated = await updateProject(activeProject.id, { name, description, instructions });
    setSaving(false);
    if (updated) {
      setActiveProject(updated);
      setProjects(projects.map((p) => (p.id === activeProject.id ? updated : p)));
    }
  };

  const handleAddDoc = async () => {
    if (!activeProject) return;
    const newDoc = await addDocument(activeProject.id, {
      name: 'untitled.txt',
      type: 'text',
      content: '',
      language: undefined,
    });
    if (newDoc) {
      const updated = await getProject(activeProject.id);
      if (updated) {
        setActiveProject(updated);
        setProjects(projects.map((p) => (p.id === activeProject.id ? updated : p)));
        setDocs(updated.documents);
        setEditingDocId(newDoc.id);
        setDraftDoc({ ...newDoc });
      }
    }
  };

  const handleSaveDoc = async () => {
    if (!activeProject || !draftDoc) return;
    const updated = await updateDocument(activeProject.id, draftDoc.id, draftDoc);
    if (updated) {
      setDocs((d) => d.map((doc) => (doc.id === updated.id ? updated : doc)));
      setEditingDocId(null);
      setDraftDoc(null);
      const refreshed = await getProject(activeProject.id);
      if (refreshed) {
        setActiveProject(refreshed);
        setProjects(projects.map((p) => (p.id === activeProject.id ? refreshed : p)));
      }
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!activeProject) return;
    if (!confirm('Delete this document?')) return;
    const ok = await deleteDocument(activeProject.id, docId);
    if (ok) {
      const refreshed = await getProject(activeProject.id);
      if (refreshed) {
        setActiveProject(refreshed);
        setProjects(projects.map((p) => (p.id === activeProject.id ? refreshed : p)));
        setDocs(refreshed.documents);
      }
    }
  };

  if (!activeProject) return null;

  const widthClass = isMobile ? 'w-full' : 'w-[340px]';

  return (
    <div
      className={`border-border-light bg-surface-sidebar relative flex h-full shrink-0 flex-col overflow-hidden border-s ${widthClass}`}
    >
      {/* Header */}
      <div className="border-border-light flex h-[3.25rem] shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="text-text-primary flex min-w-0 items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-accent-primary shrink-0" />
          <span className="truncate">Project Context</span>
        </div>
        <button
          onClick={() => setShowDocumentsPanel(false)}
          aria-label="Close panel"
          className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Project meta */}
        <div className="space-y-3 pb-3">
          <div>
            <label className="text-text-tertiary mb-1 block text-xs font-medium uppercase tracking-wide">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-search border-border-light text-text-primary w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-text-tertiary mb-1 block text-xs font-medium uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-surface-search border-border-light text-text-primary w-full resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-text-tertiary mb-1 block text-xs font-medium uppercase tracking-wide">
              Instructions (sent to AI)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Tell the AI how to behave on this project…"
              className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none"
            />
          </div>
          <button
            onClick={saveProjectMeta}
            disabled={saving}
            className="bg-accent-primary text-text-inverted hover:bg-accent-primary-hover flex w-full items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save project metadata
          </button>
        </div>

        <div className="border-border-light my-3 border-t" />

        {/* Documents */}
        <div className="flex items-center justify-between pb-2">
          <span className="text-text-primary text-sm font-semibold">Documents</span>
          <button
            onClick={handleAddDoc}
            className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            title="Add document"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {docs.length === 0 && (
            <div className="text-text-tertiary px-1 py-4 text-center text-xs">
              No documents. Click <Plus size={12} className="mx-1 inline" /> Add to create one.
            </div>
          )}

          {docs.map((doc) => {
            const Icon = TYPE_ICONS[doc.type] || FileText;
            const isEditing = editingDocId === doc.id && draftDoc;
            return (
              <div key={doc.id} className="border-border-light bg-surface-chat rounded-lg border overflow-hidden">
                {isEditing ? (
                  <div className="space-y-2 p-2">
                    <input
                      value={draftDoc?.name ?? ''}
                      onChange={(e) => setDraftDoc((d) => (d ? { ...d, name: e.target.value } : d))}
                      placeholder="filename.ext"
                      className="bg-surface-search border-border-light text-text-primary w-full rounded border px-2 py-1 font-mono text-xs outline-none"
                    />
                    <select
                      value={draftDoc?.type ?? 'text'}
                      onChange={(e) =>
                        setDraftDoc((d) => (d ? { ...d, type: e.target.value as ProjectDocument['type'] } : d))
                      }
                      className="bg-surface-search border-border-light text-text-primary w-full rounded border px-2 py-1 text-xs outline-none"
                    >
                      <option value="code">Code</option>
                      <option value="text">Text</option>
                      <option value="instruction">Instruction</option>
                      <option value="config">Config</option>
                    </select>
                    <textarea
                      value={draftDoc?.content ?? ''}
                      onChange={(e) => setDraftDoc((d) => (d ? { ...d, content: e.target.value } : d))}
                      rows={8}
                      className="bg-surface-code-body border-border-light text-text-primary w-full resize-y rounded border px-2 py-1.5 font-mono text-xs outline-none"
                      placeholder="Document content…"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleSaveDoc}
                        className="bg-accent-primary text-text-inverted hover:bg-accent-primary-hover flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingDocId(null);
                          setDraftDoc(null);
                        }}
                        className="border-border-light text-text-secondary hover:bg-surface-hover flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2 p-2">
                    <Icon size={14} className="text-accent-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-text-primary truncate text-sm font-medium">{doc.name}</div>
                      <div className="text-text-tertiary text-xs">{TYPE_LABELS[doc.type]}</div>
                      {doc.content && (
                        <div className="text-text-tertiary mt-1 line-clamp-2 text-xs font-mono">
                          {doc.content.slice(0, 120)}
                          {doc.content.length > 120 && '…'}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => {
                          setEditingDocId(doc.id);
                          setDraftDoc({ ...doc });
                        }}
                        title="Edit document"
                        className="text-text-tertiary hover:bg-surface-active hover:text-text-primary rounded p-1 opacity-0 transition group-hover:opacity-100"
                      >
                        <FileCog size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        title="Delete document"
                        className="text-text-tertiary hover:text-status-error rounded p-1 opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
