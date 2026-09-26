"use client";
import { EFFECT_PHRASE, SEV_COLOR, SEV_LABEL, SOURCE_LABEL } from "@/lib/constants";

export default function WhyPanel({ analysis, nameOf, explained, explaining, onExplain, onHover, focus, onClearFocus }) {
  const all = analysis?.interactions || [];
  const list = focus ? all.filter((i) => i.perpetrator === focus || i.victim === focus) : all;
  const modeLabel = explained
    ? { llm: "AI-rephrased · facts only", template: "From engine facts", offline: "Offline · engine facts" }[explained.mode]
    : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="panel-title">Why · {list.length} interaction{list.length === 1 ? "" : "s"}</h2>
        <button
          onClick={onExplain}
          disabled={!all.length || explaining}
          className="rounded-md border border-sky-400/30 px-2 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-400/10 disabled:opacity-40"
        >
          {explaining ? "Explaining…" : "Plain English"}
        </button>
      </div>
      {focus && (
        <button onClick={onClearFocus} className="mb-2 rounded-full bg-sky-400/10 px-2.5 py-0.5 text-xs text-sky-300">
          Showing {nameOf[focus] || focus} only ✕
        </button>
      )}
      {modeLabel && <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">{modeLabel}</div>}
      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-slate-500">
          No enzyme interactions detected{focus ? " for this drug" : ""}.
        </div>
      )}
      <ul className="space-y-2">
        {list.map((i) => {
          const color = SEV_COLOR[i.severity];
          const text = explained?.byId[i.id];
          return (
            <li
              key={i.id}
              onMouseEnter={() => onHover(new Set([i.perpetrator, i.victim, i.enzyme]))}
              onMouseLeave={() => onHover(null)}
              className={`why-card rounded-xl border bg-black/30 p-3 transition hover:bg-white/[0.04] ${i.severity === "contraindicated" ? "contra-card" : ""}`}
              style={{ borderColor: `${color}55`, borderLeft: `4px solid ${color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-slate-100">
                  {nameOf[i.perpetrator] || i.perpetrator}
                  <span className="mx-1.5 text-slate-500">→</span>
                  {nameOf[i.victim] || i.victim}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color, background: `${color}22` }}>
                  {SEV_LABEL[i.severity]}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                <span className="font-mono text-teal-300">{i.enzyme}</span> · {EFFECT_PHRASE[i.effect]} {nameOf[i.victim] || i.victim}
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-300">{text || i.facts.join(" ")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {i.sources.map((s) => (
                  <span key={s} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {SOURCE_LABEL[s] || s}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
