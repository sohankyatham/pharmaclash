"use client";
import { useEffect, useRef, useState } from "react";
import { riskTone } from "@/lib/constants";

// Animated total-risk readout; flashes when the value changes.
export default function RiskCounter({ value }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState(null);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    setFlash(b > a ? "up" : "down");
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    const timer = setTimeout(() => setFlash(null), 900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      from.current = b;
    };
  }, [value]);

  const tone = riskTone(shown);
  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">TOTAL RISK</div>
        <div className="text-[11px] text-slate-500">interactions + meters</div>
      </div>
      <div
        className={`font-mono text-5xl font-extrabold tabular-nums transition-transform duration-300 ${flash ? "scale-110" : ""}`}
        style={{ color: tone, textShadow: `0 0 24px ${tone}88` }}
      >
        {shown}
      </div>
    </div>
  );
}
