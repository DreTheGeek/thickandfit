'use client';

// Knowledge-graph canvas for the operator command center. d3-force on a 2D canvas with pan / zoom /
// node-drag / hub labels / click-detail. Ported from the proven AI Junkies University GraphCanvas
// (admin/graph/_components/GraphCanvas.tsx) - same simulation, render loop, and interaction model -
// re-skinned to the Thick & Fit palette (olive coach hub) and re-typed to our coaching entities
// (client / goal / injury / dietary / food / plan). The whole graph (~600 nodes) ships to the client,
// so view-filtering and the detail panel are computed in-memory with no extra round-trips.

import { useEffect, useMemo, useRef, useState, useTransition, type ReactElement } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { KgNode, KgEdge } from '@/lib/admin/portal';
import { rebuildGraphAction } from '@/lib/admin/kg-actions';

// Thick & Fit palette on a near-black canvas. Olive is Stephanie (the hub); category hubs get
// distinct but restrained hues; clients/foods/plans are quiet "dust" that only surfaces on zoom.
const COLOR_BY_TYPE: Record<string, string> = {
  coach: '#5EBE62', // brand olive - the gravitational center
  goal: '#E8B04B', // amber
  injury: '#E5675E', // coral
  dietary: '#5FBDD1', // teal
  condition: '#E07AB0', // pink
  plan: '#6E93F0', // blue
  client: '#9AA0A8', // muted gray dust
  food: '#B79CE8', // lilac dust
  topic: '#CAD86B', // lime
};

const SIZE_BY_TYPE: Record<string, number> = {
  coach: 20,
  goal: 14,
  injury: 12,
  dietary: 10,
  condition: 10,
  topic: 11,
  plan: 5,
  client: 3.5,
  food: 4,
};

// Category hubs always show their label; plans reveal names once zoomed in.
const ALWAYS_LABEL = new Set(['coach', 'goal', 'injury', 'dietary', 'condition', 'topic']);
const ZOOM_GATED_LABEL = new Set(['plan']);

type ViewKey = 'all' | 'nutrition' | 'health' | 'plans';
const VIEWS: { value: ViewKey; label: string; types: Set<string> }[] = [
  { value: 'all', label: 'All', types: new Set(['coach', 'client', 'goal', 'injury', 'dietary', 'condition', 'food', 'plan', 'topic']) },
  { value: 'nutrition', label: 'Nutrition', types: new Set(['coach', 'client', 'food']) },
  { value: 'health', label: 'Health & goals', types: new Set(['coach', 'client', 'injury', 'goal', 'dietary', 'condition']) },
  { value: 'plans', label: 'Plans', types: new Set(['coach', 'client', 'plan']) },
];

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: string;
  label: string;
  nodeKey: string;
  weight: number;
  color: string;
  radius: number;
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  rel: string;
  id: string;
}
type Detail = {
  node: SimNode;
  out: { rel: string; label: string; type: string }[];
  incoming: { rel: string; label: string; type: string }[];
};

function radiusFor(n: KgNode): number {
  const base = SIZE_BY_TYPE[n.type] ?? 4;
  // Clients scale a little by log volume so the power-loggers read as bigger.
  if (n.type === 'client') return Math.min(9, base + Math.sqrt(Math.max(0, n.weight)) / 2.2);
  return base;
}

export function GraphCanvas({ nodes, edges }: { nodes: KgNode[]; edges: KgEdge[] }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 0.7 });
  const draggingNodeRef = useRef<SimNode | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

  const [view, setView] = useState<ViewKey>('all');
  const [selected, setSelected] = useState<Detail | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const searchTermRef = useRef('');
  useEffect(() => { hoveredIdRef.current = hoveredId; }, [hoveredId]);
  useEffect(() => { selectedIdRef.current = selected?.node.id ?? null; }, [selected?.node.id]);
  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);

  // Filter to the active view, then build sim nodes/links. Recomputed only when data or view changes.
  const { simNodes, simLinks, nodeById } = useMemo(() => {
    const allowed = VIEWS.find((v) => v.value === view)?.types ?? new Set<string>();
    const sn: SimNode[] = nodes
      .filter((n) => allowed.has(n.type))
      .map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        nodeKey: n.key,
        weight: n.weight,
        color: COLOR_BY_TYPE[n.type] ?? '#888888',
        radius: radiusFor(n),
      }));
    const byId = new Map(sn.map((n) => [n.id, n]));
    const sl: SimLink[] = edges
      .filter((e) => byId.has(e.src_id) && byId.has(e.dst_id))
      .map((e) => ({ id: e.id, rel: e.rel, source: byId.get(e.src_id)!, target: byId.get(e.dst_id)! }));
    return { simNodes: sn, simLinks: sl, nodeById: byId };
  }, [nodes, edges, view]);

  // Build the detail payload for a node purely from the in-memory edge set.
  function openDetail(node: SimNode): void {
    const out: Detail['out'] = [];
    const incoming: Detail['incoming'] = [];
    for (const e of edges) {
      if (e.src_id === node.id) {
        const t = nodeById.get(e.dst_id);
        if (t) out.push({ rel: e.rel, label: t.label, type: t.type });
      } else if (e.dst_id === node.id) {
        const s = nodeById.get(e.src_id);
        if (s) incoming.push({ rel: e.rel, label: s.label, type: s.type });
      }
    }
    out.sort((a, b) => a.type.localeCompare(b.type));
    incoming.sort((a, b) => a.type.localeCompare(b.type));
    setSelected({ node, out, incoming });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = (): void => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            const sHub = ALWAYS_LABEL.has(s.type);
            const tHub = ALWAYS_LABEL.has(t.type);
            if (sHub && tHub) return 200;
            if (sHub || tHub) return 120;
            return 55;
          })
          .strength(0.3),
      )
      .force(
        'charge',
        forceManyBody<SimNode>().strength((d) => {
          if (d.type === 'coach') return -2200;
          if (d.type === 'goal' || d.type === 'injury' || d.type === 'dietary' || d.type === 'condition') return -650;
          if (d.type === 'plan') return -60;
          return -28; // client / food dust
        }),
      )
      .force('center', forceCenter(0, 0).strength(0.03))
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((d) => {
            if (d.type === 'coach') return d.radius + 70;
            if (ALWAYS_LABEL.has(d.type)) return d.radius + 34;
            return d.radius + 2;
          })
          .strength(0.9),
      )
      .alpha(1)
      .alphaDecay(0.025)
      .alphaTarget(0)
      .velocityDecay(0.45);

    simRef.current = sim;

    let raf = 0;
    const draw = (): void => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0A0A0B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { x: tx, y: ty, k } = transformRef.current;
      ctx.translate(canvas.width / 2 + tx * dpr, canvas.height / 2 + ty * dpr);
      ctx.scale(k * dpr, k * dpr);

      // Edges
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(94, 190, 98, 0.14)'; // olive at low alpha
      for (const l of simLinks) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        if (typeof s !== 'object' || typeof t !== 'object') continue;
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(t.x ?? 0, t.y ?? 0);
        ctx.stroke();
      }

      const currentHover = hoveredIdRef.current;
      const currentSelected = selectedIdRef.current;
      const searchLower = searchTermRef.current.trim().length > 0 ? searchTermRef.current.toLowerCase() : null;

      for (const n of simNodes) {
        const isSelected = currentSelected === n.id;
        const isHovered = currentHover === n.id;
        const isSearchHit = searchLower !== null && n.label.toLowerCase().includes(searchLower);
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = searchLower !== null && !isSearchHit ? 0.25 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (isSelected || isHovered || isSearchHit) {
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, n.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#5EBE62' : isSearchHit ? '#E8B04B' : '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      const zoom = transformRef.current.k;
      const baseFont = Math.max(9, Math.min(14, 11 / Math.sqrt(zoom)));
      const showZoomGated = zoom > 0.7;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const n of simNodes) {
        const isHub = ALWAYS_LABEL.has(n.type);
        const isZoomGated = ZOOM_GATED_LABEL.has(n.type) && showZoomGated;
        if (!isHub && !isZoomGated) continue;
        if (typeof n.x !== 'number' || typeof n.y !== 'number') continue;
        const label = n.label.length > 32 ? n.label.slice(0, 30) + '...' : n.label;
        const labelFont = n.type === 'coach' ? Math.max(13, Math.min(18, 15 / Math.sqrt(zoom))) : baseFont;
        ctx.font = `${n.type === 'coach' ? '700' : '500'} ${labelFont}px var(--font-sans), system-ui`;
        const yOffset = n.y + n.radius / Math.sqrt(zoom) + 3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(label, n.x + 0.5, yOffset + 0.5);
        ctx.fillStyle = n.type === 'coach' ? '#5EBE62' : '#E8E8E8';
        ctx.fillText(label, n.x, yOffset);
      }
      ctx.restore();
    };

    const tick = (): void => {
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const screenToWorld = (sx: number, sy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const cx = sx - rect.left - rect.width / 2 - transformRef.current.x;
      const cy = sy - rect.top - rect.height / 2 - transformRef.current.y;
      return { x: cx / transformRef.current.k, y: cy / transformRef.current.k };
    };
    const pickNode = (sx: number, sy: number): SimNode | null => {
      const { x, y } = screenToWorld(sx, sy);
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = (n.x ?? 0) - x;
        const dy = (n.y ?? 0) - y;
        if (dx * dx + dy * dy <= (n.radius + 2) * (n.radius + 2)) return n;
      }
      return null;
    };
    const onMouseDown = (e: MouseEvent): void => {
      const n = pickNode(e.clientX, e.clientY);
      if (n) {
        draggingNodeRef.current = n;
        n.fx = n.x;
        n.fy = n.y;
        sim.alphaTarget(0.3).restart();
      } else {
        const { x, y } = transformRef.current;
        panningRef.current = { startX: e.clientX, startY: e.clientY, tx: x, ty: y };
      }
    };
    const onMouseMove = (e: MouseEvent): void => {
      const dragging = draggingNodeRef.current;
      const panning = panningRef.current;
      if (dragging) {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        dragging.fx = x;
        dragging.fy = y;
      } else if (panning) {
        transformRef.current.x = panning.tx + (e.clientX - panning.startX);
        transformRef.current.y = panning.ty + (e.clientY - panning.startY);
      } else {
        const n = pickNode(e.clientX, e.clientY);
        setHoveredId(n?.id ?? null);
        canvas.style.cursor = n ? 'pointer' : 'default';
      }
    };
    const onMouseUp = (e: MouseEvent): void => {
      const dragging = draggingNodeRef.current;
      const panning = panningRef.current;
      const wasClick = panning && Math.abs(e.clientX - panning.startX) < 4 && Math.abs(e.clientY - panning.startY) < 4;
      panningRef.current = null;
      if (dragging) {
        dragging.fx = null;
        dragging.fy = null;
        openDetail(dragging);
        draggingNodeRef.current = null;
        sim.alphaTarget(0);
      } else if (wasClick) {
        const n = pickNode(e.clientX, e.clientY);
        if (n) openDetail(n);
      }
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 0.9 : 1.1;
      transformRef.current.k = Math.max(0.1, Math.min(4, transformRef.current.k * dir));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, simLinks]);

  function runRebuild(): void {
    setSyncMsg('Rebuilding from client data...');
    startTransition(async () => {
      const res = await rebuildGraphAction();
      if (!res.ok) {
        setSyncMsg(`Failed: ${res.error ?? 'unknown error'}`);
        return;
      }
      setSyncMsg(`Rebuilt: ${res.nodes} nodes, ${res.edges} edges. Reload to see updates.`);
      setTimeout(() => setSyncMsg(null), 6000);
    });
  }

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full overflow-hidden rounded-2xl border border-line bg-[#0A0A0B]">
      {/* Toolbar */}
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => { setView(v.value); setSelected(null); }}
              className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                view === v.value ? 'bg-[#5EBE62] text-black' : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search nodes..."
          className="w-60 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder-white/40 backdrop-blur"
        />
        <button
          type="button"
          onClick={runRebuild}
          className="rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/80 backdrop-blur transition-colors hover:bg-white/10"
        >
          Rebuild from client data
        </button>
        {syncMsg && (
          <p className="max-w-60 rounded-lg border border-[#5EBE62]/40 bg-[#5EBE62]/10 px-3 py-2 text-[11px] text-[#9fe0a2]">{syncMsg}</p>
        )}
      </div>

      {/* Legend */}
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur">
        {[['coach', 'Stephanie'], ['client', 'Clients'], ['goal', 'Goals'], ['injury', 'Injuries'], ['dietary', 'Dietary'], ['food', 'Foods'], ['plan', 'Plans']].map(([t, lbl]) => (
          <span key={t} className="flex items-center gap-1.5 text-[10px] text-white/70">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_BY_TYPE[t] }} />
            {lbl}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} />
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="absolute bottom-4 right-4 top-40 z-10 w-80 overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3 text-white/50 transition-colors hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
          <span
            className="inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ borderColor: selected.node.color, color: selected.node.color }}
          >
            {selected.node.type}
          </span>
          <h3 className="mb-1 mt-2 break-words pr-6 text-lg font-black text-white">{selected.node.label}</h3>
          <p className="mb-4 break-all font-mono text-[10px] text-white/40">{selected.node.nodeKey}</p>

          {selected.out.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Outgoing ({selected.out.length})</p>
              <ul className="space-y-1">
                {selected.out.slice(0, 40).map((e, i) => (
                  <li key={i} className="text-xs text-white/85">
                    <span className="text-white/40">{e.rel}</span> {' → '} <span>{e.label}</span>
                    <span className="ml-1.5 text-[10px] text-white/40">({e.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selected.incoming.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Incoming ({selected.incoming.length})</p>
              <ul className="space-y-1">
                {selected.incoming.slice(0, 40).map((e, i) => (
                  <li key={i} className="text-xs text-white/85">
                    <span>{e.label}</span>
                    <span className="ml-1.5 text-[10px] text-white/40">({e.type})</span> {' → '} <span className="text-white/40">{e.rel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 text-[10px] text-white/40">
        Click node = detail · Drag = move · Scroll = zoom · Drag empty = pan
      </div>
    </div>
  );
}
