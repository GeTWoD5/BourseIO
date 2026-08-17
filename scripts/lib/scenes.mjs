export function buildScenes(brief, config, market, narrative) {
  const duration = config.video.durationSeconds;
  const startYear = market.points[0].date.slice(0, 4);
  const endYear = market.points.at(-1).date.slice(0, 4);
  const valueScale = buildValueScale(market);
  const chartPoints = downsample(market.points, 260);
  return {
    meta: {
      width: config.video.width,
      height: config.video.height,
      fps: config.video.fps,
      durationSeconds: duration,
      createdAt: new Date().toISOString()
    },
    style: config.style,
    brief,
    narrative,
    chart: {
      points: chartPoints,
      minValue: Math.min(...market.points.map((point) => point.portfolioValue)),
      maxValue: Math.max(...market.points.map((point) => point.portfolioValue)),
      axisMin: valueScale.min,
      axisMax: valueScale.max,
      currency: market.currency,
      xAxisLabel: "Temps",
      yAxisLabel: "Valeur du portefeuille",
      legendItems: [
        { label: "Portefeuille", color: config.style.accent },
        { label: "Capital investi", color: config.style.accentHot }
      ],
      dateTicks: buildDateTicks(chartPoints, 4),
      valueTicks: valueScale.ticks,
      periodLabel: `${startYear} - ${endYear}`
    },
    timeline: [
      { id: "hook", start: 0, end: 3.2 },
      { id: "chart", start: 2.4, end: duration - 4.2 },
      { id: "low", start: duration * 0.48, end: duration * 0.6 },
      { id: "peak", start: duration * 0.68, end: duration * 0.78 },
      { id: "reveal", start: duration - 4.2, end: duration - 1.2 },
      { id: "cta", start: duration - 1.6, end: duration }
    ]
  };
}

function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (points.length - 1));
    return points[sourceIndex];
  });
}

function buildDateTicks(points, count) {
  return Array.from({ length: count }, (_, index) => {
    const pointIndex = Math.round((index / (count - 1)) * (points.length - 1));
    const point = points[pointIndex];
    return {
      index: pointIndex,
      label: point.date.slice(0, 4)
    };
  });
}

function buildValueScale(market) {
  const values = market.points.map((point) => point.portfolioValue);
  const max = Math.max(...values);
  const rawAxisMax = Math.max(1000, Math.ceil(max / 1000) * 1000);

  if (rawAxisMax <= 7000) {
    return {
      min: 0,
      max: rawAxisMax,
      ticks: Array.from({ length: rawAxisMax / 1000 + 1 }, (_, index) => index * 1000)
    };
  }

  const step = chooseLargeStep(rawAxisMax);
  const axisMax = Math.ceil(rawAxisMax / step) * step;
  const ticks = [0, 1000];
  for (let value = step; value <= axisMax; value += step) {
    if (!ticks.includes(value)) ticks.push(value);
  }
  return {
    min: 0,
    max: axisMax,
    ticks
  };
}

function chooseLargeStep(axisMax) {
  const candidates = [2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000];
  return candidates.find((step) => axisMax / step <= 5) ?? 1000000;
}
