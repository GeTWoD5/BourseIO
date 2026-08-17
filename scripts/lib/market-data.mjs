const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildMarketSeries(brief, config) {
  if (config.data.provider === "yahoo") {
    try {
      return await buildYahooMarketSeries(brief);
    } catch (error) {
      if (config.data.fallbackProvider !== "synthetic") throw error;
      const fallback = buildSyntheticMarketSeries(brief, config);
      fallback.source = {
        provider: "synthetic",
        warning: `Yahoo data unavailable, synthetic fallback used: ${error.message}`
      };
      return fallback;
    }
  }
  return buildSyntheticMarketSeries(brief, config);
}

export async function buildYahooMarketSeries(brief) {
  const symbol = brief.subject.ticker;
  const priceSeries = await fetchYahooAdjustedSeries(symbol, brief.investment.startDate, brief.investment.endDate);
  const quoteCurrency = priceSeries.currency;
  let fxSeries = null;

  if (quoteCurrency && quoteCurrency !== brief.investment.currency) {
    fxSeries = await fetchFxSeries(brief.investment.currency, quoteCurrency, brief.investment.startDate, brief.investment.endDate);
  }

  const normalized = normalizeInvestmentSeries(priceSeries.points, brief, {
    quoteCurrency,
    fxPoints: fxSeries?.points
  });
  normalized.source = {
    provider: "yahoo",
    symbol,
    quoteCurrency,
    displayCurrency: brief.investment.currency,
    fxSymbol: fxSeries?.symbol ?? null,
    firstMarketDate: priceSeries.points[0]?.date,
    lastMarketDate: priceSeries.points.at(-1)?.date,
    usesAdjustedClose: true
  };
  return normalized;
}

export function buildSyntheticMarketSeries(brief, config) {
  const start = new Date(brief.investment.startDate);
  const end = new Date(brief.investment.endDate ?? new Date().toISOString().slice(0, 10));
  const totalDays = Math.max(30, Math.round((end - start) / DAY_MS));
  const points = 260;
  const seed = hashSeed(`${brief.subject.name}:${brief.investment.startDate}`);
  const random = mulberry32(seed);
  const trend = config.data.syntheticTrend;
  const volatility = config.data.syntheticVolatility;

  let price = 28 + random() * 42;
  const series = [];

  for (let i = 0; i < points; i += 1) {
    const progress = i / (points - 1);
    const date = new Date(start.getTime() + totalDays * DAY_MS * progress);
    const cycle = Math.sin(progress * Math.PI * 6 + random() * 0.2) * volatility;
    const shock = buildShock(progress, random);
    const drift = trend * (1 + progress * 1.7);
    const dailyMove = drift + cycle + shock + (random() - 0.5) * volatility;
    price = Math.max(3, price * (1 + dailyMove));
    series.push({
      date: date.toISOString().slice(0, 10),
      price: round(price, 2)
    });
  }

  const normalized = normalizeInvestmentSeries(series, brief);
  normalized.source = {
    provider: "synthetic",
    quoteCurrency: brief.investment.currency,
    displayCurrency: brief.investment.currency,
    usesAdjustedClose: false
  };
  return normalized;
}

export function normalizeInvestmentSeries(priceSeries, brief, options = {}) {
  const investment = brief.investment;
  if (investment.mode === "monthly_dca") {
    return buildDcaSeries(priceSeries, investment.monthlyAmount ?? investment.amount, investment.currency, options);
  }
  return buildLumpSumSeries(priceSeries, investment.amount, investment.currency, options);
}

function buildLumpSumSeries(priceSeries, amount, currency, options) {
  const startPrice = priceSeries[0].price;
  const startFx = getFxRate(options.fxPoints, priceSeries[0].date);
  const units = (amount * startFx) / startPrice;
  const values = priceSeries.map((point) => ({
    ...point,
    invested: round(amount, 2),
    portfolioValue: round((units * point.price) / getFxRate(options.fxPoints, point.date), 2),
    units: round(units, 6)
  }));
  return summarize(values, amount, currency);
}

function buildDcaSeries(priceSeries, monthlyAmount, currency, options) {
  let invested = 0;
  let units = 0;
  let lastMonth = "";
  const values = priceSeries.map((point) => {
    const month = point.date.slice(0, 7);
    if (month !== lastMonth) {
      invested += monthlyAmount;
      units += (monthlyAmount * getFxRate(options.fxPoints, point.date)) / point.price;
      lastMonth = month;
    }
    return {
      ...point,
      invested: round(invested, 2),
      portfolioValue: round((units * point.price) / getFxRate(options.fxPoints, point.date), 2),
      units: round(units, 6)
    };
  });
  return summarize(values, invested, currency);
}

function summarize(values, totalInvested, currency) {
  const first = values[0];
  const last = values.at(-1);
  const min = values.reduce((best, point) => point.portfolioValue < best.portfolioValue ? point : best, first);
  const max = values.reduce((best, point) => point.portfolioValue > best.portfolioValue ? point : best, first);
  const performance = (last.portfolioValue - totalInvested) / totalInvested;

  return {
    currency,
    totalInvested: round(totalInvested, 2),
    finalValue: round(last.portfolioValue, 2),
    performancePct: round(performance * 100, 1),
    min,
    max,
    points: values
  };
}

function buildShock(progress, random) {
  const crisis = Math.exp(-Math.pow((progress - 0.62) / 0.055, 2)) * -0.018;
  const rebound = Math.exp(-Math.pow((progress - 0.76) / 0.08, 2)) * 0.016;
  const earlyNoise = progress < 0.14 ? (random() - 0.42) * 0.012 : 0;
  return crisis + rebound + earlyNoise;
}

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function fetchYahooAdjustedSeries(symbol, startDate, endDate) {
  const result = await fetchYahooChart(symbol, startDate, endDate);
  const timestamps = result.timestamp ?? [];
  const adjclose = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const points = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    price: adjclose[index] == null ? null : round(adjclose[index], 6)
  })).filter((point) => Number.isFinite(point.price));

  if (points.length < 2) {
    throw new Error(`Not enough adjusted price points for ${symbol}`);
  }

  return {
    currency: result.meta?.currency,
    points
  };
}

async function fetchFxSeries(fromCurrency, toCurrency, startDate, endDate) {
  const symbol = `${fromCurrency}${toCurrency}=X`;
  const result = await fetchYahooAdjustedSeries(symbol, startDate, endDate);
  return {
    symbol,
    points: result.points
  };
}

async function fetchYahooChart(symbol, startDate, endDate) {
  const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("events", "capitalGain|div|split");
  url.searchParams.set("formatted", "false");
  url.searchParams.set("includeAdjustedClose", "true");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("lang", "en-US");
  url.searchParams.set("region", "US");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo request failed for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const error = data.chart?.error;
  if (error) {
    throw new Error(`Yahoo chart error for ${symbol}: ${error.description ?? error.code}`);
  }
  const result = data.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo chart result missing for ${symbol}`);
  }
  return result;
}

function getFxRate(fxPoints, date) {
  if (!fxPoints?.length) return 1;
  let rate = fxPoints[0].price;
  for (const point of fxPoints) {
    if (point.date > date) break;
    rate = point.price;
  }
  return rate;
}
