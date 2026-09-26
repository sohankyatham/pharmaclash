"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEV_COLOR, SEV_RANK, hexA } from "@/lib/constants";

const ForceGraph = dynamic(() => import("./ForceGraph"), { ssr: false });

const LINK_WIDTH = { none: 0.8, low: 1.4, moderate: 2.4, high: 3.4, contraindicated: 4.6 };
const RISK_GROW = { none: 0, low: 3, moderate: 6, high: 11 };
// Node sizes in graph units; the layout below keeps neighbors ~55+ units apart.
const DRUG_R = 13;
const ENZYME_R = 17;
const RISK_R = 22;
const DRUG_IDLE = "#7dd3fc";
const ENZYME_IDLE = "#2dd4bf";
const SAFE = "#34d399";

const idOf = (end) => (typeof end === "object" ? end.id : end);
const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

function hexagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function padlock(ctx, x, y, s) {
  ctx.fillStyle = "#f5a524";
  ctx.strokeStyle = "#f5a524";
  ctx.lineWidth = s * 0.28;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.35, s * 0.42, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x - s * 0.65, y - s * 0.35, s * 1.3, s * 1.0);
}

export default function GraphView({ analysis, lockedSet, swapFrom, highlight, onNodeClick, onBackgroundClick }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const cache = useRef(new Map());
  const prevIds = useRef(new Set());
  const fitNext = useRef(true);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!analysis) return { nodes: [], links: [] };
    const now = performance.now();
    const worst = {};
    const bump = (id, sev) => {
      if (!worst[id] || SEV_RANK[sev] > SEV_RANK[worst[id]]) worst[id] = sev;
    };
    for (const i of analysis.interactions) {
      bump(i.perpetrator, i.severity);
      bump(i.victim, i.severity);
      bump(i.enzyme, i.severity);
    }
    for (const [key, m] of Object.entries(analysis.meters)) bump(`risk_${key}`, m.level);

    const prev = prevIds.current;
    const nodes = analysis.nodes.map((n) => {
      let o = cache.current.get(n.id);
      if (!o) {
        o = { id: n.id };
        cache.current.set(n.id, o);
      }
      if (!prev.has(n.id)) {
        // New on screen: pop in, and morph out of the drug it replaced (optimizer swap).
        o.born = now;
        const from = swapFrom && swapFrom[n.id] ? cache.current.get(swapFrom[n.id]) : null;
        if (from && from.x != null) {
          o.x = from.x;
          o.y = from.y;
          o.swappedAt = now;
        } else if (o.x == null) {
          o.x = (Math.random() - 0.5) * 60;
          o.y = (Math.random() - 0.5) * 60;
        }
        o.vx = 0;
        o.vy = 0;
      }
      o.label = n.label;
      o.type = n.type;
      o.sev = worst[n.id] || "none";
      o.locked = lockedSet.has(n.id);
      if (n.type === "risk") o.score = analysis.meters[n.id.replace("risk_", "")]?.score ?? 0;
      return o;
    });
    const ids = new Set(nodes.map((n) => n.id));
    if (ids.size !== prev.size || [...ids].some((id) => !prev.has(id))) fitNext.current = true;
    prevIds.current = ids;
    const links = analysis.edges.map((e) => ({ ...e }));
    return { nodes, links };
  }, [analysis, lockedSet, swapFrom]);

  // The graph instance arrives after a dynamic import, so forces are set from a callback ref
  // (as soon as it exists) and re-checked on the first tick as a fallback.
  const forcesSet = useRef(false);
  const applyForces = useCallback(() => {
    const fg = fgRef.current;
    if (!fg || !fg.d3Force) return false;
    // Short-range repulsion keeps unconnected drugs from drifting far and shrinking the fit.
    fg.d3Force("charge")?.strength(-300).distanceMax(250);
    fg.d3Force("link")?.distance((l) => (l.kind === "contributes" ? 95 : 60));
    forcesSet.current = true;
    return true;
  }, []);
  const graphRef = useCallback((fg) => {
    fgRef.current = fg;
    if (fg) applyForces();
  }, [applyForces]);

  const dimmed = useCallback((id) => highlight && !highlight.has(id), [highlight]);

  const paintNode = useCallback((node, ctx, scale) => {
    const t = performance.now();
    const age = (t - (node.born || 0)) / 650;
    const pop = age >= 1 ? 1 : easeOutBack(Math.max(0.001, age));
    const col = SEV_COLOR[node.sev];
    const fs = Math.max(3.2, 12.5 / scale);
    ctx.globalAlpha = dimmed(node.id) ? 0.15 : 1;

    if (node.type === "drug") {
      const r = DRUG_R * pop;
      if (node.sev !== "none") {
        const g = ctx.createRadialGradient(node.x, node.y, r * 0.4, node.x, node.y, r * 2.3);
        g.addColorStop(0, hexA(col, 0.5));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.3, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = "#101924";
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = node.sev === "none" ? DRUG_IDLE : col;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.38, 0, 2 * Math.PI);
      ctx.fillStyle = hexA(node.sev === "none" ? DRUG_IDLE : col, 0.9);
      ctx.fill();
      if (node.swappedAt && t - node.swappedAt < 1800) {
        const p = (t - node.swappedAt) / 1800;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + p * 40, 0, 2 * Math.PI);
        ctx.lineWidth = 3.5 * (1 - p);
        ctx.strokeStyle = hexA(SAFE, 1 - p);
        ctx.stroke();
      }
      if (node.locked) padlock(ctx, node.x + r * 0.95, node.y - r * 0.95, 5);
      ctx.font = `600 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(5,7,11,0.85)";
      const label = node.label.replace(/ \(.*\)$/, "");
      const w = ctx.measureText(label).width;
      ctx.fillRect(node.x - w / 2 - 1.5, node.y + r + 2, w + 3, fs + 1.5);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(label, node.x, node.y + r + 2.6);
    } else if (node.type === "enzyme") {
      const r = ENZYME_R * pop;
      const stroke = node.sev === "none" ? hexA(ENZYME_IDLE, 0.6) : col;
      if (node.sev !== "none") {
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
      }
      hexagon(ctx, node.x, node.y, r);
      ctx.fillStyle = "#0a1a1f";
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = `700 ${7.5}px "Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.sev === "none" ? "#99f6e4" : "#fff";
      ctx.fillText(node.label, node.x, node.y);
    } else {
      let R = (RISK_R + RISK_GROW[node.sev]) * pop;
      if (node.sev === "high") R += Math.sin(t / 260) * 2;
      const ringCol = node.sev === "none" ? "#334155" : col;
      ctx.beginPath();
      ctx.arc(node.x, node.y, R, 0, 2 * Math.PI);
      ctx.fillStyle = hexA(ringCol, 0.1);
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = ringCol;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, R + 5.5, 0, 2 * Math.PI);
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexA(ringCol, 0.5);
      ctx.stroke();
      ctx.font = `800 ${Math.max(14, fs * 1.2)}px "Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.sev === "none" ? "#64748b" : "#fff";
      ctx.fillText(String(node.score), node.x, node.y + 0.5);
      ctx.font = `700 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillStyle = node.sev === "none" ? "#64748b" : ringCol;
      ctx.fillText(node.label.toUpperCase(), node.x, node.y + R + 8);
    }
    ctx.globalAlpha = 1;
  }, [dimmed]);

  const paintArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.type === "risk" ? 34 : 18, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const linkLit = useCallback(
    (l) => !highlight || (highlight.has(idOf(l.source)) && highlight.has(idOf(l.target))),
    [highlight]);

  const linkColor = useCallback((l) => {
    let a = l.severity === "none" ? 0.3 : 0.85;
    if (l.severity === "contraindicated") a = 0.55 + 0.45 * Math.sin(performance.now() / 170);
    if (!linkLit(l)) a *= 0.1;
    return hexA(SEV_COLOR[l.severity], a);
  }, [linkLit]);

  const particles = useCallback(
    (l) => (SEV_RANK[l.severity] >= 2 && linkLit(l) ? SEV_RANK[l.severity] : 0), [linkLit]);

  return (
    <div ref={wrapRef} className="graph-bg absolute inset-0">
      {size.w > 0 && (
        <ForceGraph
          graphRef={graphRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={6}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintArea}
          nodeLabel={(n) => (n.type === "drug" ? `${n.label}${n.locked ? " (locked)" : ""}` : n.label)}
          linkColor={linkColor}
          linkWidth={(l) => LINK_WIDTH[l.severity] * (linkLit(l) ? 1 : 0.6)}
          linkLineDash={(l) => (l.kind === "activates" ? [3, 2] : null)}
          linkDirectionalParticles={particles}
          linkDirectionalParticleWidth={(l) => (SEV_RANK[l.severity] >= 3 ? 3.4 : 2.4)}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleColor={(l) => SEV_COLOR[l.severity]}
          autoPauseRedraw={false}
          cooldownTicks={220}
          cooldownTime={Infinity}
          d3VelocityDecay={0.32}
          onNodeClick={(n) => onNodeClick?.(n.id)}
          onBackgroundClick={() => onBackgroundClick?.()}
          onEngineTick={() => {
            if (!forcesSet.current && applyForces()) fgRef.current.d3ReheatSimulation();
          }}
          onEngineStop={() => {
            if (fitNext.current && fgRef.current) {
              fitNext.current = false;
              fgRef.current.zoomToFit(700, 70);
            }
          }}
        />
      )}
    </div>
  );
}
