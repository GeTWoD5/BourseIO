const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_STUDIO_SETTINGS = {
  automationEnabled: true,
  autoPublish: false,
  publishMode: "direct",
  schedule: { days: [1, 2, 3, 4, 5], hour: 8, minute: 30 },
  defaults: { amount: 1000, startDate: "2018-01-02", tone: "curiosity" },
  lastAutomationDate: null
};

const editorialUniverse = [
  ["Airbus", "AIR.PA", "aeronautique", "2016-01-04"], ["Safran", "SAF.PA", "aeronautique", "2016-01-04"],
  ["Dassault Systemes", "DSY.PA", "logiciels", "2016-01-04"], ["Schneider Electric", "SU.PA", "electrification", "2016-01-04"],
  ["Legrand", "LR.PA", "electrification", "2016-01-04"], ["Vinci", "DG.PA", "infrastructures", "2016-01-04"],
  ["Bouygues", "EN.PA", "infrastructures", "2016-01-04"], ["LVMH", "MC.PA", "luxe", "2015-01-02"],
  ["Hermes", "RMS.PA", "luxe", "2016-01-04"], ["L'Oreal", "OR.PA", "consommation", "2016-01-04"],
  ["Michelin", "ML.PA", "industrie", "2014-01-02"], ["TotalEnergies", "TTE.PA", "energie", "2016-01-04"],
  ["Vestas", "VWS.CO", "energie eolienne", "2016-01-04"], ["ASML", "ASML", "semi-conducteurs", "2016-01-04"],
  ["NVIDIA", "NVDA", "semi-conducteurs", "2019-01-02"], ["AMD", "AMD", "semi-conducteurs", "2016-01-04"],
  ["TSMC", "TSM", "semi-conducteurs", "2016-01-04"], ["Microsoft", "MSFT", "logiciels", "2016-01-04"],
  ["Apple", "AAPL", "technologie", "2016-01-04"], ["Amazon", "AMZN", "e-commerce", "2016-01-04"],
  ["Alphabet", "GOOGL", "technologie", "2016-01-04"], ["Meta", "META", "reseaux sociaux", "2016-01-04"],
  ["Netflix", "NFLX", "streaming", "2016-01-04"], ["Tesla", "TSLA", "mobilite", "2016-01-04"],
  ["Visa", "V", "paiements", "2016-01-04"], ["Mastercard", "MA", "paiements", "2016-01-04"],
  ["Berkshire Hathaway", "BRK-B", "conglomerat", "2016-01-04"], ["BlackRock", "BLK", "gestion d'actifs", "2016-01-04"],
  ["JPMorgan Chase", "JPM", "banque", "2016-01-04"], ["Eli Lilly", "LLY", "sante", "2016-01-04"],
  ["Novo Nordisk", "NVO", "sante", "2016-01-04"], ["Linde", "LIN", "industrie", "2016-01-04"],
  ["Caterpillar", "CAT", "industrie", "2016-01-04"], ["McDonald's", "MCD", "consommation", "2016-01-04"],
  ["Coca-Cola", "KO", "consommation", "2016-01-04"], ["Walmart", "WMT", "distribution", "2016-01-04"],
  ["Adobe", "ADBE", "logiciels", "2016-01-04"], ["ServiceNow", "NOW", "logiciels", "2016-01-04"],
  ["CrowdStrike", "CRWD", "cybersecurite", "2019-07-01"], ["Coinbase", "COIN", "actifs numeriques", "2021-04-14"],
  ["Rheinmetall", "RHM.DE", "defense", "2016-01-04"], ["Siemens", "SIE.DE", "industrie", "2016-01-04"],
  ["SAP", "SAP.DE", "logiciels", "2016-01-04"], ["Ferrari", "RACE", "luxe", "2016-01-04"],
  ["Novo Nordisk B", "NOVO-B.CO", "sante", "2016-01-04"], ["Accenture", "ACN", "conseil", "2016-01-04"]
].map(([name, ticker, sector, startDate]) => ({ name, ticker, sector, startDate }));

export async function buildEditorialSuggestions(existingJobs = [], { seed = 0, limit = 10 } = {}) {
  const cutoff = Date.now() - 14 * DAY_MS;
  const recent = new Set(existingJobs.filter((job) => new Date(job.createdAt).getTime() > cutoff).map((job) => job.brief?.subject?.ticker));
  const rotation = Math.abs(Number(seed) || 0) % editorialUniverse.length;
  const rotated = [...editorialUniverse.slice(rotation), ...editorialUniverse.slice(0, rotation)];
  const fresh = rotated.filter((idea) => !recent.has(idea.ticker));
  const pool = fresh.length >= limit ? fresh : [...fresh, ...rotated.filter((idea) => recent.has(idea.ticker))];
  const candidates = pool.slice(0, Math.min(Math.max(limit * 2, 14), pool.length));
  const enriched = await Promise.all(candidates.map(enrichWithMarketMove));
  return enriched
    .sort((left, right) => Math.abs(right.movePct ?? 0) - Math.abs(left.movePct ?? 0))
    .slice(0, limit)
    .map((idea) => ({ ...idea, reusedRecently: recent.has(idea.ticker) }));
}

export function createStudioBrief(input, settings = DEFAULT_STUDIO_SETTINGS) {
  const name = cleanText(input.name, 80);
  const ticker = cleanText(input.ticker, 24).toUpperCase();
  if (!name || !ticker) throw new Error("Le nom et le ticker sont obligatoires.");
  const mode = input.mode === "monthly_dca" ? "monthly_dca" : "lump_sum";
  const amount = positiveNumber(input.amount, settings.defaults.amount);
  return {
    niche: "stock_market",
    template: ["pov_investment_growth", "market_momentum", "performance_recap"].includes(input.template) ? input.template : (mode === "monthly_dca" ? "monthly_dca" : "pov_investment_growth"),
    subject: { name, ticker, sector: cleanText(input.sector, 50) || "bourse" },
    investment: { mode, amount, ...(mode === "monthly_dca" ? { monthlyAmount: positiveNumber(input.monthlyAmount, 100) } : {}), currency: "EUR", startDate: validDate(input.startDate) ?? settings.defaults.startDate, endDate: new Date().toISOString().slice(0, 10) },
    language: "fr",
    tone: ["curiosity", "educational", "punchy"].includes(input.tone) ? input.tone : settings.defaults.tone,
    brand: { accountName: "Bourse.IO", seriesTag: "bourseio" },
    // The final TikTok privacy and interaction choices are intentionally made
    // by the creator on the export screen, never preselected by the studio.
    publishing: { visibility: null, allowComments: false, allowDuet: false, allowStitch: false }
  };
}

export function assessVideoQuality({ market, caption, renderStatus, deliveryQuality }) {
  const checks = [
    { name: "Livraison video inspectee", passed: deliveryQuality?.passed === true },
    { name: "MP4 H.264", passed: renderStatus?.mp4Status === "rendered" },
    { name: "Voix off locale", passed: renderStatus?.voiceStatus === "rendered" },
    { name: "Donnees de marche reelles", passed: market?.source?.provider === "yahoo" },
    { name: "Caption TikTok", passed: Boolean(caption?.trim()) && caption.length <= 2200 },
    { name: "Serie de donnees suffisante", passed: (market?.points?.length ?? 0) >= 2 },
    { name: "Performance coherente", passed: Number.isFinite(market?.performancePct) && Math.abs(market.performancePct) < 5000 }
  ];
  const warnings = [...(deliveryQuality?.warnings ?? [])];
  if (market?.source?.provider !== "yahoo") warnings.push("Donnees Yahoo Finance indisponibles : publication automatique bloquee.");
  if ((caption?.match(/#/g) ?? []).length > 8) warnings.push("Trop de hashtags pour une publication nette.");
  return { passed: checks.every((check) => check.passed), checks, warnings };
}

async function enrichWithMarketMove(idea) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idea.ticker)}`);
    url.searchParams.set("interval", "1d"); url.searchParams.set("period1", String(now - 31 * DAY_MS / 1000)); url.searchParams.set("period2", String(now));
    const response = await fetch(url, { headers: { "User-Agent": "BourseIOStudio/1.0" } });
    if (!response.ok) throw new Error(`Yahoo ${response.status}`);
    const result = (await response.json()).chart?.result?.[0];
    const points = (result?.indicators?.adjclose?.[0]?.adjclose ?? []).filter(Number.isFinite);
    if (points.length < 2) throw new Error("Serie insuffisante");
    const movePct = round(((points.at(-1) - points[0]) / points[0]) * 100, 1);
    return { ...idea, movePct, angle: `${idea.name} : ${movePct >= 0 ? "+" : ""}${movePct}% sur un mois. Quel recul faut-il prendre ?`, source: "yahoo" };
  } catch {
    return { ...idea, movePct: null, angle: `Le parcours boursier de ${idea.name} sur le long terme.`, source: "editorial" };
  }
}

function cleanText(value, limit) { return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, limit); }
function positiveNumber(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null; }
function round(value, decimals) { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }
