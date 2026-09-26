"use client";
import { useMemo, useState } from "react";
import { SEV_COLOR, SEV_RANK } from "@/lib/constants";

const pretty = (s) => (s || "").replace(/_/g, " ");

export default function DrugPicker({ drugs, regimen, locked, analysis, onAdd, onRemove, onToggleLock, disabled }) {
  const [q, setQ] = useState("");

  const worst = useMemo(() => {
    const w = {};
    for (const i of analysis?.interactions || []) {
      for (const d of [i.perpetrator, i.victim]) {
        if (!w[d] || SEV_RANK[i.severity] > SEV_RANK[w[d]]) w[d] = i.severity;
      }
    }
    return w;
  }, [analysis]);

  const byId = useMemo(() => Object.fromEntries(drugs.map((d) => [d.id, d])), [drugs]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return drugs.filter((d) => !regimen.includes(d.id)).filter((d) => !needle
      || d.name.toLowerCase().includes(needle)
      || (d.brand || "").toLowerCase().includes(needle)
      || pretty(d.class).includes(needle));
  }, [drugs, regimen, q]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="panel-title">Regimen</h2>
          <span className="text-xs text-slate-500">{regimen.length} drugs · click lock to keep</span>
        </div>
        <ul className="space-y-1.5">
          {regimen.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-slate-500">
              Empty. Load the demo patient or add drugs below.
            </li>
          )}
          {regimen.map((id) => {
            const d = byId[id];
            const sev = worst[id];
            const isLocked = locked.has(id);
            return (
              <li key={id} className="drug-chip group flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: sev ? SEV_COLOR[sev] : "#7dd3fc", boxShadow: sev ? `0 0 8px ${SEV_COLOR[sev]}` : "none" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-slate-100">{d?.name || id}</div>
                  <div className="truncate text-[11px] text-slate-500">{pretty(d?.class)}</div>
                </div>
                <button
                  onClick={() => onToggleLock(id)}
                  disabled={disabled}
                  title={isLocked ? "Locked: the optimizer will keep it" : "Lock so the optimizer keeps it"}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide transition ${isLocked ? "bg-amber-400/15 text-amber-300" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
                >
                  {isLocked ? "Locked" : "Lock"}
                </button>
                <button
                  onClick={() => onRemove(id)}
                  disabled={disabled}
                  className="rounded-md px-1.5 text-lg leading-none text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Remove ${d?.name || id}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="panel-title mb-2">Add a drug</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, brand or class…"
          className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[15px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
        />
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => { onAdd(d.id); setQ(""); }}
                disabled={disabled}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sky-400/10"
              >
                <span className="truncate text-sm text-slate-200">
                  {d.name}
                  {d.brand && !d.name.includes(d.brand) && <span className="text-slate-500"> · {d.brand}</span>}
                </span>
                <span className="shrink-0 text-lg leading-none text-sky-400">+</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-2 text-sm text-slate-500">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
