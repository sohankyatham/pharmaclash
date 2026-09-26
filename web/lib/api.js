// Backend client with an offline fallback to pre-computed mock data (web/public/mock/).
const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

let scenarioPromise = null;
export function loadScenario() {
  if (!scenarioPromise) {
    scenarioPromise = fetch("/mock/scenario.json").then((r) => r.json());
  }
  return scenarioPromise;
}

const regimenKey = (reg) => [...new Set(reg)].sort().join(",");

async function call(path, body, timeoutMs = 4000) {
  const res = await fetch(`${API}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export async function getDrugs() {
  try {
    return { data: await call("/drugs"), live: true };
  } catch {
    return { data: await fetch("/mock/drugs.json").then((r) => r.json()), live: false };
  }
}

// Returns { data, live, exact }. `exact` is false when offline and this regimen was not
// pre-computed, in which case the demo snapshot is shown instead.
export async function analyzeRegimen(regimen) {
  try {
    return { data: await call("/analyze", { regimen }), live: true, exact: true };
  } catch {
    const scenario = await loadScenario();
    const hit = scenario.analyze[regimenKey(regimen)];
    if (hit) return { data: hit, live: false, exact: true };
    const snapshot = await fetch("/mock/analyze_demo.json").then((r) => r.json());
    return { data: snapshot, live: false, exact: false };
  }
}

export async function optimizeRegimen(regimen, locked) {
  try {
    return { data: await call("/optimize", { regimen, locked }, 8000), live: true };
  } catch {
    const scenario = await loadScenario();
    const hit = scenario.optimize[`${regimenKey(regimen)}|${[...locked].sort().join(",")}`];
    return { data: hit || null, live: false };
  }
}

export async function explainRegimen(regimen) {
  try {
    return await call("/explain", { regimen }, 30000);
  } catch {
    return null;
  }
}
