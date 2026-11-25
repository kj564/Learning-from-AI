'use client';

/**
 * MindmapView — 1:1 rebuild of pelajarin.ai mindmap canvas.
 *
 * Captured from tab-mindmap.html (authenticated):
 *   - Canvas: relative flex-1 cursor-grab select-none touch-none overflow-hidden
 *     bg-surface-secondary/40 [contain:layout_paint] [overscroll-behavior:contain]
 *   - Transform layer: absolute left-0 top-0 h-full w-full origin-top-left will-change-transform
 *   - Edges: SVG paths fill-none stroke-border, stroke-width 1.5 (GRAY, not orange)
 *   - Root node: rounded-xl px-4 py-2.5 font-heading text-base font-bold
 *     max-w-[250px] bg-primary text-text-inverse + expand chevron
 *     (-right-[13px] top-1/2 size-[26px] bg-primary-dark text-text-inverse)
 *   - Zoom controls: absolute left-4 top-4 z-20 flex flex-col gap-0.5
 *     rounded-xl bg-surface-tertiary/90 p-1.5 backdrop-blur-2xl (Fit/+/−, size-11)
 *   - NO minimap (removed — pelajarin has none)
 */

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';

interface NoteDetail {
  title?: string;
  content?: string;
  chapters?: { id: string; title: string; content?: string }[];
}

interface MmNode {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: 'root' | 'chapter' | 'topic';
}

interface MmEdge {
  id: string;
  from: MmNode;
  to: MmNode;
}

/** Extract 2-3 short sub-topics from chapter content. */
function extractTopics(content: string | undefined, max = 3): string[] {
  if (!content) return [];
  const headings = content.match(/^#{1,4}\s+(.+)$/gm);
  if (headings && headings.length > 0) {
    return headings.slice(0, max).map(h => h.replace(/^#{1,4}\s+/, '').trim()).filter(s => s.length > 0 && s.length < 80);
  }
  const sentences = content.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    return sentences.slice(0, max).map(s => s.trim()).filter(s => s.length > 0 && s.length < 90);
  }
  return content.split('\n').map(s => s.trim()).filter(s => s.length > 0).slice(0, max);
}

function MindmapCanvas({ note }: { note: NoteDetail | null }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: MmNode[] = [];
    const edges: MmEdge[] = [];
    const title = note?.title || 'Catatan Baru';
    const chapters = note?.chapters || [];

    const root: MmNode = { id: 'root', x: 0, y: 0, label: title, kind: 'root' };
    nodes.push(root);

    // Radial layout: chapters on a circle around root, topics around each chapter
    const chapterCount = Math.max(chapters.length, 1);
    const radius = 300;
    chapters.forEach((c, i) => {
      const angle = (i / chapterCount) * 2 * Math.PI - Math.PI / 2;
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius * 0.7;
      const chapter: MmNode = { id: `c-${c.id}`, x: cx, y: cy, label: c.title || `Bab ${i + 1}`, kind: 'chapter' };
      nodes.push(chapter);
      edges.push({ id: `e-root-${chapter.id}`, from: root, to: chapter });

      const topics = extractTopics(c.content, 3);
      topics.forEach((t, ti) => {
        const tAngle = angle + (ti - (topics.length - 1) / 2) * 0.42;
        const tr = 190;
        const topic: MmNode = { id: `t-${c.id}-${ti}`, x: cx + Math.cos(tAngle) * tr, y: cy + Math.sin(tAngle) * tr, label: t, kind: 'topic' };
        nodes.push(topic);
        edges.push({ id: `e-${chapter.id}-${topic.id}`, from: chapter, to: topic });
      });
    });
    return { nodes, edges };
  }, [note]);

  // Pan + zoom state (viewBox style transform like pelajarin: translate + scale)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Initial fit: center content
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: transform.x, baseY: transform.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [transform]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform(prev => ({ ...prev, x: drag.baseX + (e.clientX - drag.startX), y: drag.baseY + (e.clientY - drag.startY) }));
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => ({ ...prev, scale: Math.min(2, Math.max(0.3, prev.scale * factor)) }));
  }, []);

  // Node width estimates for edge anchors (approximation, same as pelajarin custom mm)
  const nodeW = (n: MmNode) => (n.kind === 'root' ? Math.min(250, 60 + n.label.length * 9) : n.kind === 'chapter' ? Math.min(220, 50 + n.label.length * 8) : Math.min(180, 40 + n.label.length * 7));
  const nodeH = (n: MmNode) => (n.kind === 'topic' ? 38 : 48);

  function edgePath(e: MmEdge): string {
    const a = e.from, b = e.to;
    const ax = a.x + nodeW(a) / 2, ay = a.y + nodeH(a) / 2;
    const bx = b.x + nodeW(b) / 2, by = b.y + nodeH(b) / 2;
    const mx = (ax + bx) / 2;
    return `M ${ax} ${ay} C ${mx} ${ay} ${mx} ${by} ${bx} ${by}`;
  }

  function fitToScreen() {
    setTransform(prev => ({ ...prev, scale: 1 }));
  }

  return (
    <div className="relative flex-1 cursor-grab select-none touch-none overflow-hidden bg-surface-secondary/40 [contain:layout_paint] [overscroll-behavior:contain] active:cursor-grabbing"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      {/* Transform layer — COPY PASTE class from tab-mindmap.html */}
      <div className="absolute left-0 top-0 h-full w-full origin-top-left will-change-transform" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true" style={{ width: 4000, height: 4000 }}>
          {edges.map(e => (
            <path key={e.id} d={edgePath(e)} className="fill-none stroke-border" style={{ strokeWidth: 1.5 }} />
          ))}
        </svg>
        {nodes.map(n => (
          <div key={n.id} className="absolute left-0 top-0" style={{ transform: `translate(${n.x}px, ${n.y}px)` }}>
            <div className={`inline-flex cursor-default select-none items-center gap-2 whitespace-normal rounded-xl px-4 py-2.5 font-heading font-bold max-w-[250px] ${
              n.kind === 'root'
                ? 'text-base bg-primary text-text-inverse'
                : n.kind === 'chapter'
                  ? 'text-sm bg-surface text-text-primary shadow-[0_1px_4px_rgba(16,24,40,0.14)]'
                  : 'text-xs bg-surface-tertiary text-text-secondary font-body font-semibold shadow-[0_1px_3px_rgba(16,24,40,0.10)]'
            }`}>
              <span className="min-w-0 line-clamp-3">{n.label}</span>
              {n.kind === 'root' && (
                <button type="button" aria-label={`Expand ${n.label}`} aria-expanded="false" className="absolute -right-[13px] top-1/2 -mt-[13px] grid size-[26px] flex-none cursor-pointer place-items-center rounded-full p-0 transition-colors hover:bg-text-muted/40 hover:text-text-primary bg-primary-dark text-text-inverse">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6.85 4.15c.2-.2.5-.2.7 0l5.49 5.46a.55.55 0 0 1 0 .78L7.55 15.85a.5.5 0 1 1-.7-.7L11.8 10 6.85 4.85a.5.5 0 0 1 0-.7Z" /></svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Zoom controls — COPY PASTE: absolute left-4 top-4 z-20, rounded-xl bg-surface-tertiary/90 */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-0.5 rounded-xl bg-surface-tertiary/90 p-1.5 backdrop-blur-2xl max-lg:bottom-4 max-lg:left-1/2 max-lg:top-auto max-lg:-translate-x-1/2 max-lg:flex-row max-lg:rounded-full">
        <button type="button" onClick={fitToScreen} aria-label="Fit to screen" className="grid size-11 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary">
          <Maximize2 size={18} className="shrink-0" />
        </button>
        <button type="button" onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(2, prev.scale * 1.2) }))} aria-label="Zoom in" className="grid size-11 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4a.5.5 0 0 1 .5.5v5h5a.5.5 0 1 1 0 1h-5v5a.5.5 0 1 1-1 0v-5h-5a.5.5 0 1 1 0-1h5v-5A.5.5 0 0 1 10 4Z" /></svg>
        </button>
        <button type="button" onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.8) }))} aria-label="Zoom out" className="grid size-11 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3.5 9.5h13a.5.5 0 1 1 0 1h-13a.5.5 0 1 1 0-1Z" /></svg>
        </button>
      </div>
    </div>
  );
}

export function MindmapView({ note }: { note: NoteDetail | null }) {
  return <MindmapCanvas note={note} />;
}
