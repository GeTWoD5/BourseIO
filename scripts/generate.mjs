import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildMarketSeries } from "./lib/market-data.mjs";
import { buildNarrative } from "./lib/narrative.mjs";
import { buildScenes } from "./lib/scenes.mjs";
import { ensureCleanDir, readJson, slugify, writeJson } from "./lib/fs-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const briefPath = path.resolve(root, process.argv[2] ?? "briefs/sample-airbus.json");
const configPath = path.resolve(root, "config/factory.json");

const brief = await readJson(briefPath);
const config = await readJson(configPath);
const market = await buildMarketSeries(brief, config);
const narrative = buildNarrative(brief, market);
const scenes = buildScenes(brief, config, market, narrative);
const slug = `${new Date().toISOString().slice(0, 10)}-${slugify(brief.subject.name)}-${brief.investment.mode}`;
const outputDir = path.resolve(root, "outputs", slug);

await ensureCleanDir(outputDir);
await writeJson(path.join(outputDir, "brief.json"), brief);
await writeJson(path.join(outputDir, "market.json"), market);
await writeJson(path.join(outputDir, "scenes.json"), scenes);
await writeJson(path.join(outputDir, "publish-payload.json"), {
  title: narrative.description,
  privacy_level: brief.publishing?.visibility ?? "SELF_ONLY",
  disable_duet: brief.publishing?.allowDuet === false,
  disable_comment: brief.publishing?.allowComments === false,
  disable_stitch: brief.publishing?.allowStitch === false,
  video_cover_timestamp_ms: 1000
});
await writeFile(path.join(outputDir, "caption.txt"), narrative.description, "utf8");
await writePreviewHtml(path.join(outputDir, "preview.html"), scenes);

await mkdir(path.resolve(root, "outputs"), { recursive: true });
await writeFile(path.resolve(root, "outputs/latest"), outputDir, "utf8");

console.log(`Generated: ${outputDir}`);
console.log(`Preview: ${path.join(outputDir, "preview.html")}`);

async function writePreviewHtml(filePath, sceneSpec) {
  const templatePath = path.resolve(root, "templates/preview.html");
  let html = await import("node:fs/promises").then((fs) => fs.readFile(templatePath, "utf8"));
  html = html.replace("__SCENE_SPEC__", JSON.stringify(sceneSpec));
  await writeFile(filePath, html, "utf8");
}
