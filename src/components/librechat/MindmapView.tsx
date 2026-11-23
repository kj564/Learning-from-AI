'use client';

/**
 * MindmapView — ReactFlow canvas rendering the note as a radial tree.
 *
 * Captured from pelajarin.ai Mindmap tab (E-AUTH-006 + tab-mindmap-full.png):
 *   - Root node = note title (orange, centered)
 *   - Chapter nodes radiate outward
 *   - 2-3 key sub-topics per chapter (parsed from chapter content)
 *   - Zoom controls bottom-left (44px), reset bottom-right (56px orange)
 *   - Light theme: nodes white with colored borders
 *
 * Layout: manual radial — root at (0,0), chapters on a circle, sub-topics
 * spread around each chapter. ReactFlow handles pan/zoom/minimap.
 */

import { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface NoteDetail {
  title?: string;
  content?: string;
  chapters?: { id: string; title: string; content?: string }[];
}

// Custom node component — themed to match the light/orange palette.
// One source + one target handle per node so ReactFlow can auto-route edges.
function MindNode({ data }: { data: { label: string; kind: 'root' | 'chapter' | 'topic' } }) {
  const base = 'flex items-center justify-center rounded-2xl px-4 py-2 text-center font-semibold shadow-sm border-2 relative';
  // Invisible handles — edges connect from center of each side.
  const handleStyle = { opacity: 0, width: 1, height: 1, border: 'none', background: 'transparent' } as const;
  const handles = (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
  if (data.kind === 'root') {
    return (
      <div className={base} style={{
        background: 'var(--accent-orange, #f76703)', color: '#fff', borderColor: 'var(--accent-orange, #f76703)',
        borderRadius: '20px', fontSize: '15px', maxWidth: 220, minHeight: 56, fontFamily: 'var(--font-heading, sans-serif)',
      }}>
        {handles}
        {data.label}
      </div>
    );
  }
  if (data.kind === 'chapter') {
    return (
      <div className={base} style={{
        background: '#fff', color: 'var(--text-primary, #1a1a2e)', borderColor: 'var(--accent-orange, #f76703)',
        borderRadius: '16px', fontSize: '13px', maxWidth: 180, minHeight: 44,
      }}>
        {handles}
        {data.label}
      </div>
    );
  }
  return (
    <div className={base} style={{
      background: '#fff', color: 'var(--text-muted, #6b7280)', borderColor: 'var(--border, #e5e7eb)',
      borderRadius: '12px', fontSize: '12px', maxWidth: 150, minHeight: 36, fontWeight: 500,
    }}>
      {handles}
      {data.label}
    </div>
  );
}

const nodeTypes = { mind: MindNode };

/** Extract 2-3 short sub-topics from chapter content (first sentences / headings). */
function extractTopics(content: string | undefined, max = 3): string[] {
  if (!content) return [];
  // Try markdown headings first
  const headings = content.match(/^#{1,4}\s+(.+)$/gm);
  if (headings && headings.length > 0) {
    return headings.slice(0, max).map(h => h.replace(/^#{1,4}\s+/, '').trim()).filter(s => s.length > 0 && s.length < 80);
  }
  // Otherwise take the first few sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    return sentences.slice(0, max).map(s => s.trim()).filter(s => s.length > 0 && s.length < 90);
  }
  return content.split('\n').map(s => s.trim()).filter(s => s.length > 0).slice(0, max);
}

function MindmapInner({ note }: { note: NoteDetail | null }) {
  // Build nodes + edges from the note structure
  const initial = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const title = note?.title || 'Catatan Baru';
    const chapters = note?.chapters || [];

    // Root node at center
    nodes.push({
      id: 'root', type: 'mind', position: { x: 0, y: 0 },
      data: { label: title, kind: 'root' },
    });

    const chapterCount = Math.max(chapters.length, 1);
    const radius = 280;

    chapters.forEach((c, i) => {
      const angle = (i / chapterCount) * 2 * Math.PI - Math.PI / 2;
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;
      const cId = `c-${c.id}`;
      nodes.push({
        id: cId, type: 'mind', position: { x: cx, y: cy },
        data: { label: c.title || `Bab ${i + 1}`, kind: 'chapter' },
      });
      edges.push({
        id: `e-root-${cId}`, source: 'root', target: cId,
        style: { stroke: 'var(--accent-orange, #f76703)', strokeWidth: 2 },
        type: 'smoothstep',
      });

      // Sub-topics for this chapter
      const topics = extractTopics(c.content, 3);
      topics.forEach((t, ti) => {
        const tAngle = angle + (ti - (topics.length - 1) / 2) * 0.5;
        const tr = 200;
        const tx = cx + Math.cos(tAngle) * tr;
        const ty = cy + Math.sin(tAngle) * tr;
        const tId = `t-${c.id}-${ti}`;
        nodes.push({
          id: tId, type: 'mind', position: { x: tx, y: ty },
          data: { label: t, kind: 'topic' },
        });
        edges.push({
          id: `e-${cId}-${tId}`, source: cId, target: tId,
          style: { stroke: 'var(--border, #e5e7eb)', strokeWidth: 1.5 },
          type: 'smoothstep',
        });
      });
    });

    return { nodes, edges };
  }, [note]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Re-sync when the note changes
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  return (
    <div className="h-full w-full" style={{ background: 'var(--bg-surface, #f9fafb)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background color="var(--border, #e5e7eb)" gap={24} size={1} />
        <MiniMap
          nodeColor={(n) => (n.data?.kind === 'root' ? '#f76703' : n.data?.kind === 'chapter' ? '#fff3eb' : '#fff')}
          nodeStrokeWidth={2}
          maskColor="rgba(0,0,0,0.05)"
          style={{ borderRadius: 12, border: '2px solid var(--border, #e5e7eb)' }}
        />
        <Controls
          showInteractive={false}
          className="!shadow-md !rounded-2xl !border-2"
          style={{ borderRadius: '16px' }}
        />
      </ReactFlow>
    </div>
  );
}

export function MindmapView({ note }: { note: NoteDetail | null }) {
  return (
    <ReactFlowProvider>
      <MindmapInner note={note} />
    </ReactFlowProvider>
  );
}
