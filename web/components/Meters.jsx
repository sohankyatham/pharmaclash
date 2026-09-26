import { METERS, SEV_COLOR, SEV_LABEL } from "@/lib/constants";

function Meter({ def, meter, nameOf }) {
  const level = meter?.level || "none";
  const score = meter?.score || 0;
  const color = level === "none" ? "#334155" : SEV_COLOR[level];
  const pct = Math.min(100, (score / def.max) * 100);
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[15px] font-semibold text-slate-100">{def.title}</div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: level === "none" ? "#64748b" : color }}>
            {score}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${level === "high" ? "animate-pulse" : ""}`}
            style={{ color: level === "none" ? "#64748b" : color, background: `${color}22` }}
          >
            {SEV_LABEL[level]}
          </span>
        </div>
      </div>
      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 12px ${color}` }}
        />
        {Array.from({ length: def.max - 1 }, (_, i) => (
          <div key={i} className="absolute top-0 h-full w-px bg-black/60" style={{ left: `${((i + 1) / def.max) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap gap-1">
        {(meter?.contributors || []).length === 0 ? (
          <span className="text-xs text-slate-500">No contributing drugs</span>
        ) : (
          meter.contributors.map((d) => (
            <span key={d} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-slate-300">
              {nameOf[d] || d}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function Meters({ meters, nameOf }) {
  return (
    <div className="space-y-2">
      {METERS.map((def) => (
        <Meter key={def.key} def={def} meter={meters?.[def.key]} nameOf={nameOf} />
      ))}
    </div>
  );
}
