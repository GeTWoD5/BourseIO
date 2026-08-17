import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? path.resolve(root, "outputs/latest");
const outputDir = existsSync(input) && !input.endsWith("latest")
  ? path.resolve(input)
  : (await readFile(path.resolve(root, "outputs/latest"), "utf8")).trim();

const market = JSON.parse(await readFile(path.join(outputDir, "market.json"), "utf8"));
const brief = JSON.parse(await readFile(path.join(outputDir, "brief.json"), "utf8"));
const source = market.source;

if (source?.provider !== "yahoo") {
  throw new Error("Verification expects a Yahoo-backed output.");
}

const stock = await fetchAdjustedSeries(source.symbol, brief.investment.startDate, brief.investment.endDate);
const fx = source.fxSymbol ? await fetchAdjustedSeries(source.fxSymbol, brief.investment.startDate, brief.investment.endDate) : null;

const startStock = nearestOnOrAfter(stock.points, brief.investment.startDate);
const endStock = stock.points.at(-1);
const startFx = fx ? nearestOnOrBefore(fx.points, startStock.date) : { price: 1, date: startStock.date };
const endFx = fx ? nearestOnOrBefore(fx.points, endStock.date) : { price: 1, date: endStock.date };

const units = (brief.investment.amount * startFx.price) / startStock.price;
const finalValue = (units * endStock.price) / endFx.price;
const performancePct = ((finalValue - brief.investment.amount) / brief.investment.amount) * 100;

const report = [
  "# Market Data Verification",
  "",
  `Output: ${outputDir}`,
  "",
  "## Source",
  "",
  `- Stock provider: Yahoo Finance chart API`,
  `- Stock symbol: ${source.symbol}`,
  `- Stock quote currency: ${source.quoteCurrency}`,
  `- Display currency: ${source.displayCurrency}`,
  `- FX symbol: ${source.fxSymbol ?? "none"}`,
  `- Uses adjusted close: ${source.usesAdjustedClose}`,
  "",
  "## Raw Points Used",
  "",
  `- Start stock date: ${startStock.date}`,
  `- Start adjusted stock price: ${startStock.price}`,
  `- Start FX date: ${startFx.date}`,
  `- Start FX rate: ${startFx.price}`,
  `- End stock date: ${endStock.date}`,
  `- End adjusted stock price: ${endStock.price}`,
  `- End FX date: ${endFx.date}`,
  `- End FX rate: ${endFx.price}`,
  "",
  "## Formula",
  "",
  `- Units = (${brief.investment.amount} * ${startFx.price}) / ${startStock.price} = ${round(units, 6)}`,
  `- Final value = (${round(units, 6)} * ${endStock.price}) / ${endFx.price} = ${round(finalValue, 2)} ${source.displayCurrency}`,
  `- Performance = ${round(performancePct, 1)}%`,
  "",
  "## Output Comparison",
  "",
  `- Stored units: ${market.points[0].units}`,
  `- Recomputed units: ${round(units, 6)}`,
  `- Stored final value: ${market.finalValue}`,
  `- Recomputed final value: ${round(finalValue, 2)}`,
  `- Stored performance: ${market.performancePct}%`,
  `- Recomputed performance: ${round(performancePct, 1)}%`,
  "",
  "## Caveats",
  "",
  "- This verifies the calculation against Yahoo Finance adjusted close data.",
  "- It does not include brokerage fees, taxes, spread, or intraday execution timing.",
  "- For production, prefer a licensed market-data provider and store immutable source snapshots."
].join("\n");

await writeFile(path.join(outputDir, "market-verification.md"), `${report}\n`, "utf8");
console.log(report);

async function fetchAdjustedSeries(symbol, startDate, endDate) {
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
  if (!response.ok) throw new Error(`Yahoo request failed for ${symbol}: ${response.status}`);

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo chart result missing for ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const adjclose = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const points = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    price: adjclose[index] == null ? null : round(adjclose[index], 6)
  })).filter((point) => Number.isFinite(point.price));

  return { points };
}

function nearestOnOrAfter(points, date) {
  return points.find((point) => point.date >= date) ?? points[0];
}

function nearestOnOrBefore(points, date) {
  let match = points[0];
  for (const point of points) {
    if (point.date > date) break;
    match = point;
  }
  return match;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
