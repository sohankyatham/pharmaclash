import { prettify, riskTone } from "@/lib/constants";

export default function FixPanel({ fix, nameOf, onUndo, onClose }) {
  const { result, locked } = fix;
  const drop = result.original_risk - result.optimized_risk;
  return (
    <div className="fix-panel rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] p-3">
      <div className="flex items-center justify-between">
        <h2 className="panel-title text-emerald-300">Optimized regimen</h2>
        <div className="flex gap-1">
          <button onClick={onUndo} className="rounded-md px-2 py-0.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200">Undo</button>
          <button onClick={onClose} className="rounded-md px-2 py-0.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200">✕</button>
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-3 font-mono">
        <span className="text-2xl font-bold" style={{ color: riskTone(result.original_risk) }}>{result.original_risk}</span>
        <span className="text-slate-500">→</span>
        <span className="text-3xl font-extrabold" style={{ color: riskTone(result.optimized_risk) }}>{result.optimized_risk}</span>
        {drop > 0 && <span className="text-sm text-emerald-300">−{drop} risk</span>}
      </div>

      <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
        Swaps ({result.swaps.length})
      </h3>
      {result.swaps.length === 0 && <p className="mt-1 text-sm text-slate-400">No safer combination found within listed alternatives.</p>}
      <ul className="mt-1 space-y-1.5">
        {result.swaps.map((s) => (
          <li key={s.from} className="rounded-lg bg-black/30 px-2.5 py-2">
            <div className="text-[15px] font-semibold">
              <span className="text-slate-400 line-through decoration-red-400/70">{nameOf[s.from] || s.from}</span>
              <span className="mx-2 text-emerald-400">→</span>
              <span className="text-emerald-200">{nameOf[s.to] || s.to}</span>
            </div>
            <div className="mt-0.5 text-xs leading-snug text-slate-400">{prettify(s.reason, nameOf)}</div>
          </li>
        ))}
      </ul>

      {result.unresolved.length > 0 && (
        <>
          <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Needs a clinician ({result.unresolved.length})
          </h3>
          <ul className="mt-1 space-y-1.5">
            {result.unresolved.map((u) => {
              const isLocked = locked.has(u.drug);
              return (
                <li key={u.drug} className="rounded-lg bg-black/30 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-slate-100">{nameOf[u.drug] || u.drug}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isLocked
                      ? "border-amber-400/50 text-amber-300"
                      : "border-red-400/50 text-red-300"}`}>
                      {isLocked ? "locked by you" : "no safer alternative"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs leading-snug text-slate-400">{prettify(u.issue, nameOf)}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
