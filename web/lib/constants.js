export const PAX = "nirmatrelvir_ritonavir";

export const SEV_RANK = { none: 0, low: 1, moderate: 2, high: 3, contraindicated: 4 };

export const SEV_COLOR = {
  none: "#475569",
  low: "#b8893a",
  moderate: "#f5a524",
  high: "#ff4d4d",
  contraindicated: "#ff1744",
};

export const SEV_LABEL = {
  none: "None",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  contraindicated: "Contraindicated",
};

export const EFFECT_PHRASE = {
  increased_levels: "raises levels of",
  decreased_levels: "lowers levels of",
  reduced_activation: "blocks activation of",
};

const EFFECT_SHORT = {
  increased_levels: "raises levels",
  decreased_levels: "lowers levels",
  reduced_activation: "reduces activation",
};

// Display names for the source codes used in data/drugs.json.
export const SOURCE_LABEL = {
  FDA_DDI: "FDA DDI table",
  FLOCKHART: "Flockhart Table",
  CREDIBLEMEDS: "CredibleMeds",
  ACB: "ACB Scale",
  BEERS: "AGS Beers 2023",
  DAILYMED: "DailyMed label",
  PAXLOVID_LABEL: "Paxlovid label",
};

export const METERS = [
  { key: "qt", title: "QT prolongation", short: "QT", max: 9 },
  { key: "anticholinergic", title: "Anticholinergic burden", short: "Brain fog", max: 6 },
  { key: "bleeding", title: "Bleeding risk", short: "Bleeding", max: 4 },
];

export function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function riskTone(total) {
  if (total >= 30) return SEV_COLOR.high;
  if (total >= 10) return SEV_COLOR.moderate;
  return "#34d399";
}

// Replace drug ids and effect tokens in engine-produced strings with display text.
export function prettify(text, nameOf) {
  if (!text) return "";
  let out = text.replace(/\s*\((locked|no listed alternatives); clinician review\)$/, "");
  out = out.replace(/\((increased_levels|decreased_levels|reduced_activation)\)/g,
    (_, e) => `(${EFFECT_SHORT[e]})`);
  out = out.replace(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[a-z]{4,}/g, (w) => nameOf[w] || w);
  return out;
}
