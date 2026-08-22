import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify, writeJson } from "./lib/fs-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

const name = args.name ?? args._[0];
if (!name) {
  console.log("Usage: node scripts/new-brief.mjs --name Airbus --ticker AIR.PA --amount 10000 --start 2006-01-02 --template market_momentum");
  process.exit(1);
}

const mode = args.mode ?? "lump_sum";
const brief = {
  niche: "stock_market",
  template: args.template ?? (mode === "monthly_dca" ? "monthly_dca" : "pov_investment_growth"),
  subject: {
    name,
    ticker: args.ticker ?? slugify(name).toUpperCase(),
    sector: args.sector ?? "bourse"
  },
  investment: {
    mode,
    amount: Number(args.amount ?? 1000),
    monthlyAmount: mode === "monthly_dca" ? Number(args.monthly ?? args.amount ?? 100) : undefined,
    currency: args.currency ?? "EUR",
    startDate: args.start ?? "2020-01-02",
    endDate: args.end ?? new Date().toISOString().slice(0, 10)
  },
  language: args.language ?? "fr",
  tone: args.tone ?? "curiosity",
  brand: {
    accountName: args.account ?? "Bourse_IO",
    seriesTag: args.series ?? "tendancesboursieres"
  },
  publishing: {
    visibility: "PUBLIC_TO_EVERYONE",
    allowComments: true,
    allowDuet: false,
    allowStitch: false
  }
};

if (mode !== "monthly_dca") {
  delete brief.investment.monthlyAmount;
}

const filePath = path.join(root, "briefs", `${slugify(name)}-${mode}.json`);
await writeJson(filePath, brief);
console.log(`Brief created: ${filePath}`);

function parseArgs(values) {
  const parsed = { _: [] };
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      parsed[key] = values[i + 1];
      i += 1;
    } else {
      parsed._.push(value);
    }
  }
  return parsed;
}
