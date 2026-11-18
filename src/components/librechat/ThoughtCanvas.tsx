/**
 * Thought Canvas — spatial 2D alternative to linear chat.
 *
 * Each node is a question / answer / code / image / web-search-result.
 * Edges show causality: this question → that answer. Branching: click any
 * node → "branch from here" → 3 AI alternatives appear side-by-side.
 *
 * The AI sees ALL nodes on the canvas as context (not just the last 10
 * messages). This is the structural advantage over linear chat.
 *
 * Implementation:
 *   - Pan + zoom with mouse drag / wheel (CSS transform on a single .canvas-surface div)
 *   - Nodes positioned in a sparse grid; new nodes auto-place near last focused node
 *   - Edges are SVG <line> elements on a layer behind the nodes (scales with the same transform)
 *   - State persisted to zustand (same store as chat) so reload preserves canvas
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { streamChat, generateImage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Sparkles, Plus, ZoomIn, ZoomOut, Maximize, X, Loader2,
  GitBranch, Send, Globe, Image as ImageIcon,
} from 'lucide-react';

interface CanvasNode {
  id: string;
  type: 'question' | 'answer' | 'code' | 'image' | 'websearch';
  content: string;
  x: number;
  y: number;
  parentId: string | null; // edge parent → this
  branchOf?: string | null; // alt-versions share parentId, differ in branchOf
  pending?: boolean;
  images?: { url: string; prompt: string; width: number; height: number }[];
  webSearch?: { query: string; results: { url: string; name: string; snippet: string; host_name: string }[] };
  model?: string;
  error?: string;
}

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const GRID = 320; // spacing between auto-placed nodes

export default function ThoughtCanvas({ onClose }: { onClose: () => void }) {
  const activeConversationId = useStore((s) => s.activeConversationId);
  const selectedModel = useStore((s) => s.selectedModel);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const activeProject = useStore((s) => s.activeProject);
  const activeAssistant = useStore((s) => s.assistants.find((a) => a.id === s.activeAssistantId) || null);
  const sessionByConversation = useStore((s) => s.sessionByConversation);
  const setSessionForConversation = useStore((s) => s.setSessionForConversation);

  // Persisted canvas state (per conversation)
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const all = JSON.parse(localStorage.getItem('thought-canvas') || '{}');
      return (all[activeConversationId || 'default'] || []) as CanvasNode[];
    } catch { return []; }
  });

  // Persist nodes to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const all = JSON.parse(localStorage.getItem('thought-canvas') || '{}');
      all[activeConversationId || 'default'] = nodes;
      localStorage.setItem('thought-canvas', JSON.stringify(all));
    } catch { /* quota */ }
  }, [nodes, activeConversationId]);

  // Pan + zoom state
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [composer, setComposer] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Pan with mouse drag on background
  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    // Only start pan if click was on the surface itself (not a node)
    if (e.target !== surfaceRef.current) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setView((v) => ({ ...v, x: dragState.current!.origX + dx, y: dragState.current!.origY + dy }));
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Zoom with wheel
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => {
      const next = Math.max(0.25, Math.min(3, v.zoom - e.deltaY * 0.0015));
      return { ...v, zoom: next };
    });
  };

  // Place a new node at a free position near the focused one
  const placeNear = (parentId: string | null): { x: number; y: number } => {
    if (!parentId || nodes.length === 0) {
      // Place near center (in canvas coords)
      return { x: -180, y: -80 };
    }
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return { x: -180, y: -80 };
    // Place to the right of parent, offset vertically for siblings
    const siblings = nodes.filter((n) => n.parentId === parentId).length;
    return {
      x: parent.x + GRID,
      y: parent.y + siblings * 180,
    };
  };

  // === Create a question node + spawn AI answer nodes ===
  const ask = useCallback(async (text: string, parentId: string | null = null, branchCount = 1) => {
    if (!text.trim()) return;
    const convoId = activeConversationId;
    if (!convoId) return;

    // 1. Create the question node
    const qNode: CanvasNode = {
      id: genId('q'),
      type: 'question',
      content: text,
      ...placeNear(parentId),
      parentId,
    };
    setNodes((n) => [...n, qNode]);
    setFocused(qNode.id);

    // 2. Create N answer nodes (branchCount) — same parent, different branches
    const aNodes: CanvasNode[] = [];
    for (let i = 0; i < branchCount; i++) {
      const pos = placeNear(qNode.id);
      aNodes.push({
        id: genId('a'),
        type: 'answer',
        content: '',
        x: pos.x,
        y: pos.y + i * 220,
        parentId: qNode.id,
        branchOf: `branch_${i}`,
        pending: true,
        model: selectedModel,
      });
    }
    setNodes((n) => [...n, ...aNodes]);

    // 3. Build canvas context string — ALL visible nodes, not just last 10
    const canvasContext = nodes
      .map((n) => `[${n.type}] ${n.content.slice(0, 500)}`)
      .join('\n\n');
    const augmentedMessage = canvasContext
      ? `Canvas context so far:\n${canvasContext}\n\n---\nNew question: ${text}`
      : text;

    // 4. Stream each answer node
    const sessionId = sessionByConversation[convoId];
    aNodes.forEach((aNode, i) => {
      const controller = streamChat(
        {
          message: augmentedMessage,
          sessionId: i === 0 ? sessionId : undefined, // only first answer uses existing session
          conversationId: convoId,
          model: selectedModel,
          project: activeProject || undefined,
          assistant: activeAssistant
            ? { id: activeAssistant.id, name: activeAssistant.name, systemPrompt: activeAssistant.systemPrompt }
            : null,
        },
        {
          onTextDelta: (delta) => {
            setNodes((curr) => curr.map((n) =>
              n.id === aNode.id ? { ...n, content: n.content + delta, pending: false } : n
            ));
          },
          onDone: (event) => {
            if (i === 0) setSessionForConversation(convoId, event.sessionId);
            setNodes((curr) => curr.map((n) =>
              n.id === aNode.id ? { ...n, pending: false } : n
            ));
          },
          onError: (msg) => {
            setNodes((curr) => curr.map((n) =>
              n.id === aNode.id ? { ...n, pending: false, error: msg } : n
            ));
          },
        }
      );
      // Could abort on unmount; skipping for prototype
      void controller;
    });
  }, [nodes, activeConversationId, selectedModel, activeProject, activeAssistant, sessionByConversation, setSessionForConversation]);

  const handleSend = () => {
    const t = composer.trim();
    if (!t) return;
    setComposer('');
    void ask(t, focused, webSearchEnabled ? 1 : 1);
  };

  // Branch from any node — generate 3 alt answers
  const branchFrom = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    toast('Branching — generating 3 alt-answers…');
    void ask(node.content, node.parentId, 3);
  };

  // Generate an image from a node's content (or composer text)
  const generateImageFromNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const prompt = node.content.slice(0, 200);
    const pos = placeNear(nodeId);
    const imgNode: CanvasNode = {
      id: genId('img'),
      type: 'image',
      content: prompt,
      x: pos.x,
      y: pos.y + 220,
      parentId: nodeId,
      pending: true,
      images: [],
    };
    setNodes((n) => [...n, imgNode]);
    try {
      const img = await generateImage({ prompt, size: '1024x1024' });
      if (img) {
        setNodes((curr) => curr.map((n) =>
          n.id === imgNode.id
            ? { ...n, pending: false, images: [{ url: img.url, prompt, width: img.width, height: img.height }] }
            : n
        ));
      }
    } catch (e) {
      setNodes((curr) => curr.map((n) =>
        n.id === imgNode.id ? { ...n, pending: false, error: e instanceof Error ? e.message : String(e) } : n
      ));
    }
  };

  // Center the view on a node when clicked
  const focusNode = (n: CanvasNode) => {
    setFocused(n.id);
    setView((v) => ({
      ...v,
      x: -n.x * v.zoom + (window.innerWidth - 360) / 2, // 360 ≈ sidebar width
      y: -n.y * v.zoom + (window.innerHeight - 100) / 2,
    }));
  };

  // Edges (SVG layer)
  const edges = nodes
    .filter((n) => n.parentId)
    .map((n) => {
      const p = nodes.find((x) => x.id === n.parentId);
      if (!p) return null;
      return { from: p, to: n };
    })
    .filter(Boolean) as { from: CanvasNode; to: CanvasNode }[];

  return (
    <div className="bg-surface-canvas fixed inset-0 z-[150] overflow-hidden">
      {/* Top bar */}
      <div className="border-border-light bg-surface-popover/90 absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur">
        <Sparkles size={16} className="text-accent-primary" />
        <span className="text-text-primary text-sm font-semibold">Thought Canvas</span>
        <span className="text-text-tertiary text-xs">— spatial alternative to linear chat</span>
        <div className="ms-auto flex items-center gap-1">
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Zoom in"><ZoomIn size={14} /></button>
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.25, v.zoom / 1.2) }))} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Zoom out"><ZoomOut size={14} /></button>
          <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Reset view"><Maximize size={14} /></button>
          <div className="text-text-tertiary mx-2 text-xs tabular-nums">{Math.round(view.zoom * 100)}%</div>
          <button onClick={onClose} className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-md" title="Exit canvas"><X size={16} /></button>
        </div>
      </div>

      {/* Surface (pan + zoom) */}
      <div
        ref={surfaceRef}
        onMouseDown={onSurfaceMouseDown}
        onWheel={onWheel}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ top: 48 }}
      >
        {/* SVG edges layer (scales with the same transform as nodes) */}
        <svg
          className="pointer-events-none absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        >
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.from.x + 180}
                y1={e.from.y + 40}
                x2={e.to.x}
                y2={e.to.y + 40}
                stroke="rgb(var(--border-medium))"
                strokeWidth={2 / view.zoom}
                strokeDasharray="6 4"
              />
            ))}
          </g>
        </svg>

        {/* Nodes layer */}
        <div
          className="absolute"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: '0 0' }}
        >
          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              focused={focused === n.id}
              onClick={() => focusNode(n)}
              onBranch={() => branchFrom(n.id)}
              onGenerateImage={() => generateImageFromNode(n.id)}
            />
          ))}
        </div>
      </div>

      {/* Composer (bottom center) */}
      <div className="absolute bottom-4 left-1/2 z-30 w-[min(640px,calc(100%-2rem))] -translate-x-1/2">
        <div className="bg-surface-composer border-border-light composer-shadow-focused flex items-end gap-2 rounded-2xl border p-2">
          <textarea
            ref={composerRef}
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={focused ? 'Ask a follow-up… (the canvas is the context)' : 'Ask anything… a node appears on the canvas'}
            rows={1}
            className="text-text-primary placeholder:text-text-tertiary max-h-32 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!composer.trim()}
            className="bg-surface-submit text-text-inverted hover:bg-surface-submit-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="text-text-tertiary mt-1 text-center text-xs">
          Click a node to focus · "Branch" generates 3 alt-answers · drag to pan · scroll to zoom
        </div>
      </div>
    </div>
  );
}

/** Single node card on the canvas. */
function NodeCard({
  node, focused, onClick, onBranch, onGenerateImage,
}: {
  node: CanvasNode;
  focused: boolean;
  onClick: () => void;
  onBranch: () => void;
  onGenerateImage: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group absolute w-[360px] cursor-pointer rounded-xl border bg-surface-chat p-3 shadow-lg transition ${
        focused ? 'border-accent-primary ring-2 ring-accent-primary/30' : 'border-border-light hover:border-border-medium'
      } ${node.pending ? 'animate-pulse' : ''}`}
      style={{ left: node.x, top: node.y }}
    >
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${
          node.type === 'question' ? 'text-status-info' :
          node.type === 'answer' ? 'text-accent-primary' :
          node.type === 'image' ? 'text-status-warning' :
          node.type === 'code' ? 'text-status-success' :
          'text-text-secondary'
        }`}>
          {node.type}
          {node.model && <span className="text-text-tertiary ml-1 normal-case">· {node.model}</span>}
        </span>
        {node.branchOf && (
          <span className="text-text-tertiary text-[10px]">· {node.branchOf}</span>
        )}
        <div className="ms-auto flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {node.type === 'answer' && (
            <button
              onClick={(e) => { e.stopPropagation(); onBranch(); }}
              title="Branch — generate 3 alt-answers"
              className="hover:bg-surface-active text-text-tertiary hover:text-accent-primary rounded p-1"
            >
              <GitBranch size={12} />
            </button>
          )}
          {(node.type === 'question' || node.type === 'answer') && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateImage(); }}
              title="Generate image from this"
              className="hover:bg-surface-active text-text-tertiary hover:text-status-warning rounded p-1"
            >
              <ImageIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {node.pending && !node.content ? (
        <div className="text-text-tertiary flex items-center gap-2 py-2 text-xs">
          <Loader2 size={12} className="animate-spin" /> thinking…
        </div>
      ) : node.error ? (
        <div className="text-status-error text-xs">{node.error}</div>
      ) : node.images && node.images.length > 0 ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={node.images[0].url} alt={node.images[0].prompt} className="w-full rounded-lg" />
          <div className="text-text-tertiary mt-1 truncate text-xs">{node.images[0].prompt}</div>
        </div>
      ) : (
        <div className="text-text-primary max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
          {node.content.slice(0, 600)}
          {node.content.length > 600 && '…'}
        </div>
      )}
    </div>
  );
}
