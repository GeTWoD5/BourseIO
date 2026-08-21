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
const narrative = buildNarrative(brief, market, config.video.durationSeconds);
const scenes = buildScenes(brief, config, market, narrative);
const outputTag = slugify(process.env.BOURSE_OUTPUT_TAG ?? "");
const slug = [
  new Date().toISOString().slice(0, 10),
  slugify(brief.subject.name),
  brief.investment.mode,
  outputTag
].filter(Boolean).join("-");
const outputDir = path.resolve(root, "outputs", slug);

await ensureCleanDir(outputDir);
await writeJson(path.join(outputDir, "brief.json"), brief);
await writeJson(path.join(outputDir, "market.json"), market);
await writeJson(path.join(outputDir, "scenes.json"), scenes);
await writeJson(path.join(outputDir, "publish-payload.json"), {
  title: narrative.description,
  // This file is only a proposed caption. Final post settings are collected
  // from the creator in the TikTok export screen immediately before upload.
  privacy_level: null,
  disable_duet: brief.publishing?.allowDuet === false,
  disable_comment: brief.publishing?.allowComments === false,
  disable_stitch: brief.publishing?.allowStitch === false,
  video_cover_timestamp_ms: 1000
});
await writeFile(path.join(outputDir, "caption.txt"), narrative.description, "utf8");
await writeFile(path.join(outputDir, "voiceover.txt"), `${narrative.voiceover}\n`, "utf8");
await writeFile(path.join(outputDir, "subtitles.srt"), subtitlesToSrt(narrative.subtitles), "utf8");
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

function subtitlesToSrt(subtitles) {
  return subtitles.map((subtitle, index) => [
    String(index + 1),
    `${formatSrtTime(subtitle.start)} --> ${formatSrtTime(subtitle.end)}`,
    subtitle.text,
    ""
  ].join("\n")).join("\n");
}

function formatSrtTime(seconds) {
  const totalMilliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return [hours, minutes, wholeSeconds].map((part) => String(part).padStart(2, "0")).join(":") + `,${String(milliseconds).padStart(3, "0")}`;
}
