export function buildNarrative(brief, market) {
  const amount = formatMoney(brief.investment.amount, brief.investment.currency);
  const finalValue = formatMoney(market.finalValue, brief.investment.currency);
  const performance = `${market.performancePct > 0 ? "+" : ""}${market.performancePct}%`;
  const year = brief.investment.startDate.slice(0, 4);
  const subject = brief.subject.name;
  const isDca = brief.investment.mode === "monthly_dca";
  const hook = isDca
    ? `POV: tu investis ${formatMoney(brief.investment.monthlyAmount ?? brief.investment.amount, brief.investment.currency)}/mois dans ${subject} depuis ${year}`
    : `POV: t'as investi ${amount} dans ${subject} en ${year}`;

  const caption = `${hook}. Résultat: ${finalValue} (${performance}).`;
  const hashtags = buildHashtags(brief);

  return {
    hook,
    title: subject,
    subtitle: isDca ? "Investissement mensuel simule" : "Investissement initial simule",
    startLabel: year,
    finalLabel: finalValue,
    performanceLabel: performance,
    totalInvestedLabel: formatMoney(market.totalInvested, brief.investment.currency),
    riskLabel: `Point bas: ${formatMoney(market.min.portfolioValue, brief.investment.currency)}`,
    peakLabel: `Pic: ${formatMoney(market.max.portfolioValue, brief.investment.currency)}`,
    disclaimer: "Simulation educative, pas un conseil financier.",
    cta: `Tu veux voir quelle action ensuite ?`,
    caption,
    hashtags,
    description: `${caption}\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}`
  };
}

function buildHashtags(brief) {
  const subjectTag = brief.subject.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sectorTag = brief.subject.sector?.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const blockedTags = new Set([
    "autovideobourse",
    "auto",
    "automatique",
    "automation",
    "ia",
    "ai",
    "tendancesboursieres"
  ]);
  return [...new Set([
    "bourse",
    "epargne",
    "investissement",
    "patrimoine",
    "libertefinanciere",
    sectorTag,
    subjectTag
  ].filter(Boolean))]
    .filter((tag) => !blockedTags.has(tag))
    .slice(0, 6);
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}
