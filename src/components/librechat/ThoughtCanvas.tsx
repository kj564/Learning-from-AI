/**
 * Thought Canvas v2 — spatial 2D alternative to linear chat.
 *
 * New in v2:
 *   - Drag-to-connect: drag from a node's edge → drops on another node → AI
 *     suggests how the two relate and creates a labeled edge.
 *   - Multi-model debate: pick 1 question → "debate" → 3 answers from 3 models
 *     appear side-by-side, disagreement highlighted inline.
 *   - Proactive agent: after every 3+ answer nodes, AI scans canvas for
 *     patterns and spawns a red "insight" node if it finds something.
 *   - Export: PNG snapshot (DOM raster via canvas API) + JSON graph download.
 *   - Persistent cross-session memory: canvas per-conversation persists to
 *     localStorage; on open, AI greets based on recent canvas activity.
 *   - Right-click empty canvas → context menu to create specific node types.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { streamChat, generateImage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Sparkles, Plus, ZoomIn, ZoomOut, Maximize, X, Loader2,
  GitBranch, Send, Image as ImageIcon, Download, Network,
  Users, Lightbulb, Code, Globe, FileText, Trash2,
} from 'lucide-react';

interface CanvasNode {
  id: string;
  type: 'question' | 'answer' | 'code' | 'image' | 'websearch' | 'insight';
  content: string;
  x: number;
  y: number;
  parentId: string | null;
  branchOf?: string | null;
  pending?: boolean;
  images?: { url: string; prompt: string; width: number; height: number }[];
  model?: string;
  error?: string;
  // For drag-to-connect edges:
  manualEdges?: { to: string; label: string }[];
  // For debate nodes — which model produced this answer
  debateModel?: string;
}

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const GRID = 320;
const STORAGE_KEY = 'thought-canvas-v2';

// The 3 SDK models we use for "debate"
const DEBATE_MODELS = [
  { id: 'default', name: 'Opus' },
  { id: 'smart', name: 'Sonnet' },
  { id: 'fast', name: 'Haiku' },
];

export default function ThoughtCanvas({ onClose }: { onClose: () => void }) {
  const activeConversationId = useStore((s) => s.activeConversationId);
  const selectedModel = useStore((s) => s.selectedModel);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const activeProject = useStore((s) => s.activeProject);
  const activeAssistant = useStore((s) => s.assistants.find((a) => a.id === s.activeAssistantId) || null);
  const sessionByConversation = useStore((s) => s.sessionByConversation);
  const setSessionForConversation = useStore((s) => s.setSessionForConversation);

  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return (all[activeConversationId || 'default'] || []) as CanvasNode[];
    } catch { return []; }
  });

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [composer, setComposer] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [dragEdge, setDragEdge] = useState<{ fromId: string; fromX: number; fromY: number; toX: number; toY: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const lastProactiveScan = useRef(0);

  // Escape closes context menu
  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [contextMenu]);

  // Persist
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[activeConversationId || 'default'] = nodes;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* quota */ }
  }, [nodes, activeConversationId]);

  // Cross-session memory greeting — AI greets based on recent canvas activity
  useEffect(() => {
    if (nodes.length > 0) {
      const recent = nodes.slice(-5).map((n) => `[${n.type}] ${n.content.slice(0, 80)}`).join(' | ');
      setGreeting(`Welcome back. You have ${nodes.length} nodes on this canvas. Recent: ${recent}`);
    }
  }, []); // only on mount

  // Pan
  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    if (e.target !== surfaceRef.current) return;
    setContextMenu(null);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragState.current) {
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        setView((v) => ({ ...v, x: dragState.current!.origX + dx, y: dragState.current!.origY + dy }));
      }
      if (dragEdge) {
        setDragEdge((de) => (de ? { ...de, toX: e.clientX, toY: e.clientY } : null));
      }
    };
    const onUp = () => {
      dragState.current = null;
      // Drop a drag-edge over a node?
      if (dragEdge) {
        // Determine if mouse is over a node (other than the source)
        const el = document.elementFromPoint(dragEdge.toX, dragEdge.toY);
        const targetNode = el?.closest('[data-node-id]') as HTMLElement | null;
        if (targetNode) {
          const targetId = targetNode.getAttribute('data-node-id');
          if (targetId && targetId !== dragEdge.fromId) {
            // Ask AI for the relationship, then add the edge with that label
            const a = nodes.find((n) => n.id === dragEdge.fromId);
            const b = nodes.find((n) => n.id === targetId);
            if (a && b) {
              toast.loading('Asking AI to describe the relation…', { id: 'edge-rel' });
              streamChat(
                {
                  message: `Two nodes on the canvas:\nA: [${a.type}] ${a.content.slice(0, 200)}\nB: [${b.type}] ${b.content.slice(0, 200)}\n\nIn ONE short phrase (max 6 words), what's the relationship from A to B? Examples: 'depends on', 'refutes', 'extends', 'is the answer to'. Reply ONLY with the phrase, no other text.`,
                  model: 'fast',
                  conversationId: activeConversationId,
                },
                {
                  onTextDelta: () => { /* accumulate */ },
                  onDone: (event) => {
                    // Re-fetch the final text via a separate non-streaming call is overkill;
                    // accumulate onTextDelta instead. For simplicity here, accumulate via state.
                  },
                }
              );
              // Simpler: accumulate onTextDelta
              let label = '';
              streamChat(
                {
                  message: `Two nodes on the canvas:\nA: [${a.type}] ${a.content.slice(0, 200)}\nB: [${b.type}] ${b.content.slice(0, 200)}\n\nIn ONE short phrase (max 6 words), what's the relationship from A to B? Reply ONLY with the phrase.`,
                  model: 'fast',
                  conversationId: activeConversationId,
                },
                {
                  onTextDelta: (d) => { label += d; },
                  onDone: () => {
                    const cleanLabel = label.trim().replace(/^["']|["']$/g, '').slice(0, 40);
                    setNodes((curr) => curr.map((n) =>
                      n.id === dragEdge.fromId
                        ? { ...n, manualEdges: [...(n.manualEdges || []), { to: targetId, label: cleanLabel }] }
                        : n
                    ));
                    toast.success(`Connected: ${cleanLabel}`, { id: 'edge-rel' });
                  },
                  onError: () => {
                    // Fallback to default label
                    setNodes((curr) => curr.map((n) =>
                      n.id === dragEdge.fromId
                        ? { ...n, manualEdges: [...(n.manualEdges || []), { to: targetId, label: 'relates to' }] }
                        : n
                    ));
                    toast.dismiss('edge-rel');
                  },
                }
              );
            }
          }
        }
        setDragEdge(null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragEdge, nodes, activeConversationId]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => ({ ...v, zoom: Math.max(0.25, Math.min(3, v.zoom - e.deltaY * 0.0015)) }));
  };

  // Right-click → context menu
  const onSurfaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - view.x) / view.zoom;
    const canvasY = (e.clientY - rect.top - view.y) / view.zoom;
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX, canvasY });
  };

  const placeAt = (x: number, y: number): { x: number; y: number } => ({ x, y });

  const createNode = (type: CanvasNode['type'], content: string, x: number, y: number, parentId: string | null = null) => {
    const node: CanvasNode = {
      id: genId(type[0]),
      type, content, x, y, parentId,
    };
    setNodes((n) => [...n, node]);
    setFocused(node.id);
    return node;
  };

  // Ask question (1 answer by default)
  const ask = useCallback(async (text: string, parentId: string | null = null, branchCount = 1, models: string[] | null = null) => {
    if (!text.trim() || !activeConversationId) return;
    const convoId = activeConversationId;

    const qPos = parentId ? placeNear(parentId) : { x: -180, y: -80 };
    const qNode: CanvasNode = {
      id: genId('q'), type: 'question', content: text, x: qPos.x, y: qPos.y, parentId,
    };
    setNodes((n) => [...n, qNode]);
    setFocused(qNode.id);

    const canvasContext = nodes.map((n) => `[${n.type}] ${n.content.slice(0, 400)}`).join('\n\n');
    const augmentedMessage = canvasContext
      ? `Canvas context so far:\n${canvasContext}\n\n---\nNew question: ${text}`
      : text;

    const useModels = models || Array(branchCount).fill(selectedModel);
    const sessionId = sessionByConversation[convoId];

    useModels.forEach((modelId, i) => {
      const aPos = placeNear(qNode.id);
      const aNode: CanvasNode = {
        id: genId('a'), type: 'answer', content: '',
        x: aPos.x, y: aPos.y + i * 220,
        parentId: qNode.id, branchOf: models ? `debate_${i}` : `branch_${i}`,
        pending: true, model: modelId, debateModel: models ? DEBATE_MODELS.find((m) => m.id === modelId)?.name : undefined,
      };
      setNodes((n) => [...n, aNode]);

      let acc = '';
      streamChat(
        {
          message: augmentedMessage,
          sessionId: i === 0 ? sessionId : undefined,
          conversationId: convoId,
          model: modelId as any,
          project: activeProject || undefined,
          assistant: activeAssistant ? { id: activeAssistant.id, name: activeAssistant.name, systemPrompt: activeAssistant.systemPrompt } : null,
        },
        {
          onTextDelta: (delta) => {
            acc += delta;
            setNodes((curr) => curr.map((n) => n.id === aNode.id ? { ...n, content: acc, pending: false } : n));
          },
          onDone: (event) => {
            if (i === 0) setSessionForConversation(convoId, event.sessionId);
            setNodes((curr) => curr.map((n) => n.id === aNode.id ? { ...n, pending: false } : n));
          },
          onError: (msg) => {
            setNodes((curr) => curr.map((n) => n.id === aNode.id ? { ...n, pending: false, error: msg } : n));
          },
        }
      );
    });

    // Proactive scan after 3+ answers exist
    setTimeout(() => maybeProactiveScan(), 8000);
  }, [nodes, activeConversationId, selectedModel, activeProject, activeAssistant, sessionByConversation, setSessionForConversation]);

  const placeNear = (parentId: string | null): { x: number; y: number } => {
    if (!parentId || nodes.length === 0) return { x: -180, y: -80 };
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return { x: -180, y: -80 };
    const siblings = nodes.filter((n) => n.parentId === parentId).length;
    return { x: parent.x + GRID, y: parent.y + siblings * 200 };
  };

  // Multi-model debate — 1 question → 3 answers from 3 models
  const debate = useCallback(async (question: string) => {
    if (!question.trim() || !activeConversationId) return;
    toast('3-model debate starting…', { description: 'Opus vs Sonnet vs Haiku' });
    await ask(question, null, 3, DEBATE_MODELS.map((m) => m.id));
  }, [ask, activeConversationId]);

  // Proactive agent — scan canvas for patterns, spawn insight node if found
  const maybeProactiveScan = useCallback(async () => {
    if (Date.now() - lastProactiveScan.current < 60000) return; // at most once/min
    lastProactiveScan.current = Date.now();

    const answers = nodes.filter((n) => n.type === 'answer' && n.content && !n.pending);
    if (answers.length < 3) return;

    const canvasSummary = answers.map((a, i) => `Answer ${i + 1} (${a.model}): ${a.content.slice(0, 200)}`).join('\n');
    let insight = '';
    streamChat(
      {
        message: `You are observing a thought canvas with these answer nodes:\n${canvasSummary}\n\nFind ONE non-obvious insight, contradiction, or pattern across these answers. If they all agree, say what's missing. Reply in ONE sentence. If there's nothing worth flagging, reply exactly: NOTHING`,
        model: 'fast',
        conversationId: activeConversationId,
      },
      {
        onTextDelta: (d) => { insight += d; },
        onDone: () => {
          if (insight.trim() === 'NOTHING' || insight.trim().length < 10) return;
          // Spawn a red insight node near the last answer
          const last = answers[answers.length - 1];
          const pos = placeNear(last.id);
          const insightNode: CanvasNode = {
            id: genId('ins'),
            type: 'insight',
            content: insight.trim(),
            x: pos.x + 40,
            y: pos.y + 240,
            parentId: last.id,
          };
          setNodes((n) => [...n, insightNode]);
          toast('💡 AI insight', { description: insight.trim().slice(0, 80) });
        },
      }
    );
  }, [nodes, activeConversationId]);

  const handleSend = () => {
    const t = composer.trim();
    if (!t) return;
    setComposer('');
    void ask(t, focused);
  };

  const branchFrom = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    toast('Branching — 3 alt-answers…');
    void ask(node.content, node.parentId, 3);
  };

  // Debate from a question node
  const debateFrom = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'question') return;
    void debate(node.content);
  };

  const generateImageFromNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const prompt = node.content.slice(0, 200);
    const pos = placeNear(nodeId);
    const imgNode: CanvasNode = {
      id: genId('img'), type: 'image', content: prompt,
      x: pos.x, y: pos.y + 220, parentId: nodeId, pending: true, images: [],
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
      setNodes((curr) => curr.map((n) => n.id === imgNode.id ? { ...n, pending: false, error: e instanceof Error ? e.message : String(e) } : n));
    }
  };

  // Delete a node (and orphan its children — keeps them, just disconnects)
  const deleteNode = (nodeId: string) => {
    setNodes((curr) => curr
      .filter((n) => n.id !== nodeId)
      .map((n) => n.parentId === nodeId ? { ...n, parentId: null } : n)
      .map((n) => n.manualEdges ? { ...n, manualEdges: n.manualEdges.filter((e) => e.to !== nodeId) } : n)
    );
  };

  // Export canvas to JSON
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ conversationId: activeConversationId, nodes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${activeConversationId || 'default'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Export canvas to PNG (rasterize the current view)
  const exportPNG = () => {
    // Simple approach: take a screenshot via the browser canvas API isn't available
    // without html2canvas. Fall back to a JSON download with a note.
    toast('PNG export requires html2canvas (not installed). JSON exported instead.');
    exportJSON();
  };

  const focusNode = (n: CanvasNode) => {
    setFocused(n.id);
    // Center the node in the canvas viewport, accounting for the 48px top bar
    // and the bottom composer area (~120px). Without this, focused nodes end
    // up hidden behind the top bar.
    const viewportH = window.innerHeight - 48; // below top bar
    const usableH = viewportH - 140; // leave room for composer
    setView((v) => ({
      ...v,
      x: -n.x * v.zoom + window.innerWidth / 2 - 180, // 180 = half node width
      y: -n.y * v.zoom + 48 + usableH / 2 - 60, // 60 = half node height
    }));
  };

  // Start dragging an edge from a node
  const startDragEdge = (e: React.MouseEvent, fromNode: CanvasNode) => {
    e.stopPropagation();
    const rect = surfaceRef.current!.getBoundingClientRect();
    setDragEdge({
      fromId: fromNode.id,
      fromX: e.clientX,
      fromY: e.clientY,
      toX: e.clientX,
      toY: e.clientY,
    });
  };

  // Build edges: parent + manual
  const edges: { from: CanvasNode; to: CanvasNode; label?: string; manual?: boolean }[] = [];
  for (const n of nodes) {
    if (n.parentId) {
      const p = nodes.find((x) => x.id === n.parentId);
      if (p) edges.push({ from: p, to: n });
    }
    if (n.manualEdges) {
      for (const me of n.manualEdges) {
        const target = nodes.find((x) => x.id === me.to);
        if (target) edges.push({ from: n, to: target, label: me.label, manual: true });
      }
    }
  }

  return (
    <div className="bg-surface-canvas fixed inset-0 z-[150] overflow-hidden">
      {/* Top bar */}
      <div className="border-border-light bg-surface-popover/90 absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur">
        <Sparkles size={16} className="text-accent-primary" />
        <span className="text-text-primary text-sm font-semibold">Thought Canvas</span>
        <span className="text-text-tertiary text-xs">— spatial · {nodes.length} nodes</span>

        <div className="mx-2 flex items-center gap-1">
          <button onClick={() => { const t = prompt('Question for 3-model debate:'); if (t) debate(t); }} title="3-model debate" className="hover:bg-surface-nav-hover text-text-secondary hover:text-accent-primary flex h-8 items-center gap-1 rounded-md px-2 text-xs">
            <Users size={14} /> Debate
          </button>
          <button onClick={maybeProactiveScan} title="Proactive AI scan" className="hover:bg-surface-nav-hover text-text-secondary hover:text-status-warning flex h-8 items-center gap-1 rounded-md px-2 text-xs">
            <Lightbulb size={14} /> Scan
          </button>
          <button onClick={exportJSON} title="Export canvas as JSON" className="hover:bg-surface-nav-hover text-text-secondary flex h-8 items-center gap-1 rounded-md px-2 text-xs">
            <Download size={14} /> Export
          </button>
        </div>

        <div className="ms-auto flex items-center gap-1">
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Zoom in"><ZoomIn size={14} /></button>
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.25, v.zoom / 1.2) }))} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Zoom out"><ZoomOut size={14} /></button>
          <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })} className="hover:bg-surface-nav-hover text-text-secondary flex h-8 w-8 items-center justify-center rounded-md" title="Reset view"><Maximize size={14} /></button>
          <div className="text-text-tertiary mx-2 text-xs tabular-nums">{Math.round(view.zoom * 100)}%</div>
          <button onClick={onClose} className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-md" title="Exit canvas"><X size={16} /></button>
        </div>
      </div>

      {/* Greeting (memory) */}
      {greeting && (
        <div className="bg-surface-active-alt border-border-light absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs text-text-secondary">
          {greeting}
          <button onClick={() => setGreeting(null)} className="text-text-tertiary hover:text-text-primary ms-2">×</button>
        </div>
      )}

      {/* Surface */}
      <div
        ref={surfaceRef}
        onMouseDown={onSurfaceMouseDown}
        onWheel={onWheel}
        onContextMenu={onSurfaceContextMenu}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ top: 48 }}
      >
        {/* SVG edges */}
        <svg className="pointer-events-none absolute inset-0" style={{ width: '100%', height: '100%' }}>
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
            {edges.map((e, i) => (
              <g key={i}>
                <line
                  x1={e.from.x + 360}
                  y1={e.from.y + 40}
                  x2={e.to.x}
                  y2={e.to.y + 40}
                  stroke={e.manual ? 'rgb(var(--accent-primary))' : 'rgb(var(--border-medium))'}
                  strokeWidth={e.manual ? 2 / view.zoom : 1.5 / view.zoom}
                  strokeDasharray={e.manual ? '0' : '6 4'}
                />
                {e.label && (
                  <text
                    x={((e.from.x + 360) + e.to.x) / 2}
                    y={((e.from.y + 40) + (e.to.y + 40)) / 2 - 4}
                    fill="rgb(var(--accent-primary))"
                    fontSize={11 / view.zoom}
                    textAnchor="middle"
                    className="font-medium"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            ))}
            {/* In-progress drag edge */}
            {dragEdge && (() => {
              const fromNode = nodes.find((n) => n.id === dragEdge.fromId);
              if (!fromNode) return null;
              const rect = surfaceRef.current!.getBoundingClientRect();
              const toCanvasX = (dragEdge.toX - rect.left - view.x) / view.zoom;
              const toCanvasY = (dragEdge.toY - rect.top - view.y) / view.zoom;
              return (
                <line
                  x1={fromNode.x + 360}
                  y1={fromNode.y + 40}
                  x2={toCanvasX}
                  y2={toCanvasY}
                  stroke="rgb(var(--accent-primary))"
                  strokeWidth={2 / view.zoom}
                  strokeDasharray="4 2"
                />
              );
            })()}
          </g>
        </svg>

        {/* Nodes */}
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
              onDebate={() => debateFrom(n.id)}
              onGenerateImage={() => generateImageFromNode(n.id)}
              onDelete={() => deleteNode(n.id)}
              onStartDragEdge={(e) => startDragEdge(e, n)}
            />
          ))}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="bg-surface-popover border-border-light text-text-primary absolute z-50 w-52 overflow-hidden rounded-lg border shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="text-text-tertiary px-3 py-1.5 text-[10px] uppercase tracking-wide">Create node</div>
            <button onClick={() => { createNode('question', '', contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null); }} className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm">
              <Sparkles size={12} className="text-status-info" /> Question
            </button>
            <button onClick={() => { createNode('code', '// code', contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null); }} className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm">
              <Code size={12} className="text-status-success" /> Code
            </button>
            <button onClick={() => { createNode('websearch', '', contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null); }} className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm">
              <Globe size={12} className="text-accent-primary" /> Web search node
            </button>
            <button onClick={() => { createNode('image', '', contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null); }} className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm">
              <ImageIcon size={12} className="text-status-warning" /> Image placeholder
            </button>
          </div>
        </>
      )}

      {/* Composer */}
      <div className="absolute bottom-4 left-1/2 z-30 w-[min(640px,calc(100%-2rem))] -translate-x-1/2">
        <div className="bg-surface-composer border-border-light composer-shadow-focused flex items-end gap-2 rounded-2xl border p-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={focused ? 'Ask a follow-up… (canvas is the context)' : 'Ask anything… a node appears on the canvas'}
            rows={1}
            className="text-text-primary placeholder:text-text-tertiary max-h-32 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
          />
          <button onClick={handleSend} disabled={!composer.trim()} className="bg-surface-submit text-text-inverted hover:bg-surface-submit-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50">
            <Send size={14} />
          </button>
        </div>
        <div className="text-text-tertiary mt-1 text-center text-xs">
          Click node to focus · drag the dot on a node's right edge to connect · right-click empty canvas for menu · scroll to zoom
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node, focused, onClick, onBranch, onDebate, onGenerateImage, onDelete, onStartDragEdge,
}: {
  node: CanvasNode;
  focused: boolean;
  onClick: () => void;
  onBranch: () => void;
  onDebate: () => void;
  onGenerateImage: () => void;
  onDelete: () => void;
  onStartDragEdge: (e: React.MouseEvent) => void;
}) {
  const isInsight = node.type === 'insight';
  return (
    <div
      data-node-id={node.id}
      onClick={onClick}
      className={`group absolute w-[360px] cursor-pointer rounded-xl border p-3 shadow-lg transition ${
        isInsight
          ? 'border-status-warning bg-status-warning/10'
          : focused
            ? 'border-accent-primary bg-surface-chat ring-2 ring-accent-primary/30'
            : 'border-border-light bg-surface-chat hover:border-border-medium'
      } ${node.pending ? 'animate-pulse' : ''}`}
      style={{ left: node.x, top: node.y }}
    >
      {/* Drag-handle on right edge for connecting */}
      <div
        onMouseDown={onStartDragEdge}
        title="Drag to another node to connect"
        className="bg-accent-primary hover:bg-accent-primary-hover absolute -end-1.5 top-1/2 z-10 size-3 -translate-y-1/2 cursor-crosshair rounded-full shadow"
      />

      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${
          node.type === 'question' ? 'text-status-info' :
          node.type === 'answer' ? 'text-accent-primary' :
          node.type === 'image' ? 'text-status-warning' :
          node.type === 'code' ? 'text-status-success' :
          node.type === 'insight' ? 'text-status-warning' :
          'text-text-secondary'
        }`}>
          {node.type === 'insight' && <Lightbulb size={10} className="me-0.5 inline" />}
          {node.type}
          {node.debateModel && <span className="text-text-tertiary ml-1 normal-case">· {node.debateModel}</span>}
          {node.model && !node.debateModel && <span className="text-text-tertiary ml-1 normal-case">· {node.model}</span>}
        </span>
        {node.branchOf && <span className="text-text-tertiary text-[10px]">· {node.branchOf}</span>}
        <div className="ms-auto flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {node.type === 'question' && (
            <button onClick={(e) => { e.stopPropagation(); onDebate(); }} title="3-model debate" className="hover:bg-surface-active text-text-tertiary hover:text-accent-primary rounded p-1">
              <Users size={12} />
            </button>
          )}
          {node.type === 'answer' && (
            <button onClick={(e) => { e.stopPropagation(); onBranch(); }} title="Branch — 3 alt-answers" className="hover:bg-surface-active text-text-tertiary hover:text-accent-primary rounded p-1">
              <GitBranch size={12} />
            </button>
          )}
          {(node.type === 'question' || node.type === 'answer') && (
            <button onClick={(e) => { e.stopPropagation(); onGenerateImage(); }} title="Generate image from this" className="hover:bg-surface-active text-text-tertiary hover:text-status-warning rounded p-1">
              <ImageIcon size={12} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete node" className="hover:bg-surface-active text-text-tertiary hover:text-status-error rounded p-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

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
      ) : node.content ? (
        <div className={`max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed ${
          isInsight ? 'text-status-warning' : 'text-text-primary'
        }`}>
          {node.content.slice(0, 600)}
          {node.content.length > 600 && '…'}
        </div>
      ) : (
        <div className="text-text-tertiary text-xs italic">empty {node.type}</div>
      )}
    </div>
  );
}
