"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrugPicker from "@/components/DrugPicker";
import FixPanel from "@/components/FixPanel";
import GraphView from "@/components/GraphView";
import Meters from "@/components/Meters";
import RiskCounter from "@/components/RiskCounter";
import WhyPanel from "@/components/WhyPanel";
import { analyzeRegimen, explainRegimen, getDrugs, loadScenario, optimizeRegimen } from "@/lib/api";
import { PAX, SEV_COLOR } from "@/lib/constants";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATUS = {
  checking: { text: "Connecting…", color: "#64748b" },
  live: { text: "Live engine", color: "#34d399" },
  mock: { text: "Offline · demo data", color: "#f5a524" },
  snapshot: { text: "Offline · demo snapshot", color: "#ff4d4d" },
};

export default function Home() {
  const [drugs, setDrugs] = useState([]);
  const [demoRegimen, setDemoRegimen] = useState(null);
  const [regimen, setRegimen] = useState([]);
  const [locked, setLocked] = useState(() => new Set());
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState("checking");
  const [swapFrom, setSwapFrom] = useState({});
  const [activeSwap, setActiveSwap] = useState(null);
  const [hover, setHover] = useState(null);
  const [focus, setFocus] = useState(null);
  const [fix, setFix] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState(null);
  const [explained, setExplained] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    getDrugs().then(({ data, live }) => {
      setDrugs(data);
      setStatus(live ? "live" : "mock");
    });
    loadScenario().then((s) => setDemoRegimen(s.demo.regimen)).catch(() => {});
  }, []);

  useEffect(() => {
    const mine = ++seq.current;
    setExplained(null);
    if (!regimen.length) {
      setAnalysis(null);
      return;
    }
    analyzeRegimen(regimen).then((r) => {
      if (mine !== seq.current) return;
      setAnalysis(r.data);
      setStatus(r.live ? "live" : r.exact ? "mock" : "snapshot");
    });
  }, [regimen]);

  const nameOf = useMemo(() => {
    const m = {};
    for (const d of drugs) m[d.id] = d.name.replace(/ \(.*\)$/, "");
    return m;
  }, [drugs]);

  const focusSet = useMemo(() => {
    if (!focus || !analysis) return null;
    const s = new Set([focus]);
    for (const i of analysis.interactions) {
      if (i.perpetrator === focus || i.victim === focus) [i.perpetrator, i.victim, i.enzyme].forEach((x) => s.add(x));
    }
    for (const [k, m] of Object.entries(analysis.meters)) if (m.contributors.includes(focus)) s.add(`risk_${k}`);
    for (const e of analysis.edges) if (e.source === focus) s.add(e.target);
    return s;
  }, [focus, analysis]);

  const resetView = () => {
    setFix(null);
    setFixError(null);
    setFocus(null);
    setSwapFrom({});
  };

  const loadDemo = () => {
    if (!demoRegimen) return;
    resetView();
    setLocked(new Set());
    setRegimen([...demoRegimen]);
  };
  const addDrug = (id) => {
    resetView();
    setRegimen((r) => (r.includes(id) ? r : [...r, id]));
  };
  const removeDrug = (id) => {
    resetView();
    setRegimen((r) => r.filter((d) => d !== id));
    setLocked((l) => {
      const n = new Set(l);
      n.delete(id);
      return n;
    });
  };
  const toggleLock = (id) => setLocked((l) => {
    const n = new Set(l);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const runFix = useCallback(async (lockSet) => {
    const lk = lockSet || locked;
    setFixing(true);
    setFixError(null);
    setFocus(null);
    setFix(null);
    const before = [...regimen];
    const { data } = await optimizeRegimen(before, [...lk]);
    if (!data) {
      setFixError("Backend offline and this regimen isn't in the demo data. Start the API to optimize.");
      setFixing(false);
      return;
    }
    let cur = before;
    for (const s of data.swaps) {
      setActiveSwap(s);
      setSwapFrom({ [s.to]: s.from });
      cur = cur.map((d) => (d === s.from ? s.to : d));
      setRegimen(cur);
      await sleep(1150);
    }
    setActiveSwap(null);
    setFix({ result: data, locked: new Set(lk), before });
    setFixing(false);
  }, [locked, regimen]);

  const demoFix = () => {
    const lk = new Set(locked).add(PAX);
    setLocked(lk);
    runFix(lk);
  };

  const undoFix = () => {
    if (!fix) return;
    const before = fix.before;
    resetView();
    setRegimen(before);
  };

  const explain = async () => {
    if (!analysis) return;
    setExplaining(true);
    const r = await explainRegimen(regimen);
    if (r) {
      setExplained({ mode: r.mode, byId: Object.fromEntries(r.explanations.map((e) => [e.interaction_id, e.text])) });
    } else {
      setExplained({
        mode: "offline",
        byId: Object.fromEntries(analysis.interactions.map((i) => [i.id, i.explanation || i.facts.join(" ")])),
      });
    }
    setExplaining(false);
  };

  const has = (id) => regimen.includes(id);
  const steps = [
    { n: 1, label: "Load patient", done: demoRegimen && demoRegimen.every(has), onClick: loadDemo, enabled: !!demoRegimen },
    { n: 2, label: "+ Paxlovid", done: has(PAX), onClick: () => addDrug(PAX), enabled: regimen.length > 0 && !has(PAX) },
    { n: 3, label: "+ Clarithromycin", done: has("clarithromycin") || has("azithromycin"), onClick: () => addDrug("clarithromycin"), enabled: has(PAX) && !has("clarithromycin") },
    { n: 4, label: "Fix (Paxlovid locked)", done: !!fix, onClick: demoFix, enabled: has(PAX) && !fix },
  ];

  const total = analysis?.total_risk ?? 0;
  const st = STATUS[status];
  const counts = useMemo(() => {
    const c = { contraindicated: 0, high: 0, moderate: 0, low: 0 };
    for (const i of analysis?.interactions || []) c[i.severity] += 1;
    return c;
  }, [analysis]);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/5 bg-black/40 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <div className="logo-mark" aria-hidden />
          <div className="leading-tight">
            <div className="text-2xl font-extrabold tracking-tight text-white">
              Pharma<span className="text-red-400">Clash</span>
            </div>
            <div className="text-[11px] text-slate-500">Medication-safety engine · educational prototype, not for clinical use</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-wrap items-center justify-center gap-2" aria-label="Demo steps">
          {steps.map((s) => (
            <button
              key={s.n}
              onClick={s.onClick}
              disabled={!s.enabled || fixing}
              className={`demo-step flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${s.done
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : s.enabled ? "border-sky-400/40 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20" : "border-white/10 text-slate-500"}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-emerald-400 text-black" : "bg-white/10"}`}>
                {s.done ? "✓" : s.n}
              </span>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold" style={{ color: st.color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
            {st.text}
          </span>
          <RiskCounter value={total} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        <aside className="panel min-h-[420px] p-3 lg:min-h-0">
          <DrugPicker
            drugs={drugs}
            regimen={regimen}
            locked={locked}
            analysis={analysis}
            onAdd={addDrug}
            onRemove={removeDrug}
            onToggleLock={toggleLock}
            disabled={fixing}
          />
        </aside>

        <section className="panel relative min-h-[60vh] overflow-hidden lg:min-h-0">
          <GraphView
            analysis={analysis}
            lockedSet={locked}
            swapFrom={swapFrom}
            highlight={hover || focusSet}
            onNodeClick={(id) => setFocus((f) => (f === id ? null : id))}
            onBackgroundClick={() => setFocus(null)}
          />

          {analysis && (
            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
              {["contraindicated", "high", "moderate", "low"].filter((k) => counts[k]).map((k) => (
                <span key={k} className="rounded-full px-3 py-1 text-sm font-bold"
                  style={{ color: SEV_COLOR[k], background: `${SEV_COLOR[k]}1f`, border: `1px solid ${SEV_COLOR[k]}55` }}>
                  {counts[k]} {k}
                </span>
              ))}
            </div>
          )}

          {activeSwap && (
            <div className="swap-toast absolute left-1/2 top-5 -translate-x-1/2 rounded-2xl border border-emerald-400/40 bg-black/80 px-5 py-3 text-center shadow-2xl backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Swapping</div>
              <div className="text-2xl font-bold">
                <span className="text-slate-400 line-through decoration-red-400">{nameOf[activeSwap.from]}</span>
                <span className="mx-3 text-emerald-400">→</span>
                <span className="text-emerald-200">{nameOf[activeSwap.to]}</span>
              </div>
            </div>
          )}

          {!analysis && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
              <div className="text-3xl font-bold text-slate-200">See how risk builds across a whole regimen</div>
              <div className="max-w-md text-slate-400">Drugs, the liver enzymes they share, and the cumulative QT, anticholinergic and bleeding load.</div>
              <button onClick={loadDemo} disabled={!demoRegimen}
                className="rounded-full bg-sky-400 px-6 py-3 text-lg font-bold text-black shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:bg-sky-300 disabled:opacity-40">
                Load demo patient (80 y/o, 8 drugs)
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-sky-300" /> drug</span>
            <span className="flex items-center gap-1.5"><span className="hex-legend" /> enzyme</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-[3px] border-slate-400" /> risk</span>
            {["low", "moderate", "high", "contraindicated"].map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded" style={{ background: SEV_COLOR[k] }} /> {k}
              </span>
            ))}
            <span className="text-slate-500">· click a node to focus</span>
          </div>
        </section>

        <aside className="panel flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
          <div>
            <h2 className="panel-title mb-2">Cumulative risk</h2>
            <Meters meters={analysis?.meters} nameOf={nameOf} />
          </div>

          <button
            onClick={() => runFix()}
            disabled={!regimen.length || fixing}
            className={`fix-button rounded-2xl px-5 py-4 text-left disabled:cursor-not-allowed disabled:opacity-40 ${total >= 30 && !fixing ? "fix-glow" : ""}`}
          >
            <div className="text-xl font-extrabold text-white">{fixing ? "Optimizing…" : "Fix this regimen"}</div>
            <div className="text-xs text-white/80">
              {locked.size ? `${locked.size} locked · ` : ""}swaps only to each drug&apos;s listed alternatives
            </div>
          </button>
          {fixError && <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-2 text-sm text-red-200">{fixError}</div>}
          {fix && <FixPanel fix={fix} nameOf={nameOf} onUndo={undoFix} onClose={() => setFix(null)} />}

          <WhyPanel
            analysis={analysis}
            nameOf={nameOf}
            explained={explained}
            explaining={explaining}
            onExplain={explain}
            onHover={setHover}
            focus={focus}
            onClearFocus={() => setFocus(null)}
          />
        </aside>
      </main>
    </div>
  );
}
