export function buildNarrative(brief, market, durationSeconds = 24) {
  const amount = formatMoney(brief.investment.amount, brief.investment.currency);
  const finalValue = formatMoney(market.finalValue, brief.investment.currency);
  const performance = `${market.performancePct > 0 ? "+" : ""}${market.performancePct}%`;
  const year = brief.investment.startDate.slice(0, 4);
  const subject = brief.subject.name;
  const isDca = brief.investment.mode === "monthly_dca";
  const template = normalizeTemplate(brief.template, isDca);
  const monthly = formatMoney(brief.investment.monthlyAmount ?? brief.investment.amount, brief.investment.currency);
  const copy = buildTemplateCopy({ template, subject, year, amount, monthly, isDca });
  const hashtags = buildHashtags(brief, template);
  const voiceoverLines = [
    copy.hook,
    copy.context,
    `Au total, le portefeuille atteint ${finalValue}, soit ${performance}.`,
    copy.insight,
    "C'est une simulation \u00e9ducative, pas un conseil financier.",
    "Dis-moi quelle action tu veux voir ensuite."
  ];
  const voiceover = voiceoverLines.join(" ");

  return {
    hook: copy.hook,
    title: subject,
    subtitle: copy.subtitle,
    template,
    templateLabel: copy.label,
    startLabel: year,
    finalLabel: finalValue,
    performanceLabel: performance,
    totalInvestedLabel: formatMoney(market.totalInvested, brief.investment.currency),
    riskLabel: `Point bas: ${formatMoney(market.min.portfolioValue, brief.investment.currency)}`,
    peakLabel: `Pic: ${formatMoney(market.max.portfolioValue, brief.investment.currency)}`,
    disclaimer: "Simulation \u00e9ducative, pas un conseil financier.",
    cta: "Tu veux voir quelle action ensuite ?",
    caption: `${copy.caption} R\u00e9sultat: ${finalValue} (${performance}).`,
    hashtags,
    voiceover,
    voiceoverLines,
    subtitles: buildSubtitles(voiceoverLines, durationSeconds),
    description: `${copy.caption} R\u00e9sultat: ${finalValue} (${performance}).\\n\\n${hashtags.map((tag) => `#${tag}`).join(" ")}`
  };
}

function normalizeTemplate(value, isDca) {
  if (isDca) return "monthly_dca";
  return ["market_momentum", "performance_recap", "pov_investment_growth"].includes(value)
    ? value
    : "pov_investment_growth";
}

function buildTemplateCopy({ template, subject, year, amount, monthly, isDca }) {
  if (template === "monthly_dca") {
    return {
      label: "DCA mensuel",
      subtitle: "Investissement mensuel simul\u00e9",
      hook: `Et si tu avais investi ${monthly} par mois dans ${subject} depuis ${year} ?`,
      context: "Chaque mois, le m\u00eame montant est investi sans chercher le bon moment.",
      insight: `Le r\u00e9sultat montre l'effet du temps et de la r\u00e9gularit\u00e9 sur ${subject}.`,
      caption: `Investir ${monthly}/mois dans ${subject} depuis ${year}`
    };
  }
  if (template === "market_momentum") {
    return {
      label: "Mouvement du march\u00e9",
      subtitle: "Performance long terme simul\u00e9e",
      hook: `${subject} fait parler d'elle en Bourse. Mais qu'aurait donn\u00e9 un investissement d\u00e8s ${year} ?`,
      context: `On simule un investissement unique de ${amount}, avec les cours historiques ajust\u00e9s.`,
      insight: "Une forte variation r\u00e9cente ne pr\u00e9juge pas de l'avenir : l'horizon reste la variable cl\u00e9.",
      caption: `${subject} : le recul du long terme face au mouvement du moment`
    };
  }
  if (template === "performance_recap") {
    return {
      label: "R\u00e9cap performance",
      subtitle: "Bilan historique simul\u00e9",
      hook: `Le bilan de ${subject} depuis ${year} en quelques secondes.`,
      context: `D\u00e9part avec ${amount}, sans frais ni fiscalit\u00e9 dans cette simulation.`,
      insight: "Les performances pass\u00e9es ne garantissent jamais les performances futures.",
      caption: `Le bilan historique de ${subject} depuis ${year}`
    };
  }
  return {
    label: "Et si tu avais investi",
    subtitle: isDca ? "Investissement mensuel simul\u00e9" : "Investissement initial simul\u00e9",
    hook: `Et si tu avais investi ${amount} dans ${subject} en ${year} ?`,
    context: "Voici l'\u00e9volution de cet investissement avec les donn\u00e9es historiques ajust\u00e9es.",
    insight: "Le chemin a connu des hausses et des baisses : le long terme reste d\u00e9terminant.",
    caption: `Et si tu avais investi ${amount} dans ${subject} en ${year}`
  };
}

function buildSubtitles(lines, duration) {
  const start = 0.35;
  const available = Math.max(8, duration - 1.2 - start);
  const weight = lines.map((line) => Math.max(1, line.length)).reduce((sum, value) => sum + value, 0);
  let cursor = start;
  return lines.map((text) => {
    const length = Math.max(1.5, available * (text.length / weight));
    const segment = {
      start: round(cursor, 2),
      end: round(Math.min(duration - 0.35, cursor + length), 2),
      text
    };
    cursor = segment.end;
    return segment;
  });
}

function buildHashtags(brief, template) {
  const subjectTag = brief.subject.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sectorTag = brief.subject.sector?.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const formatTag = template === "monthly_dca" ? "dca" : template === "market_momentum" ? "actualitebourse" : "investissementlongterme";
  const blockedTags = new Set(["autovideobourse", "auto", "automatique", "automation", "ia", "ai", "tendancesboursieres"]);
  return [...new Set(["bourse", "epargne", "investissement", "patrimoine", formatTag, sectorTag, subjectTag].filter(Boolean))]
    .filter((tag) => !blockedTags.has(tag))
    .slice(0, 6);
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
