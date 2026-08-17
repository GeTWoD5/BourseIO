import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireRuntimePackage } from "./lib/runtime-deps.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? path.resolve(root, "outputs/latest");
const outputDir = existsSync(input) && !input.endsWith("latest")
  ? path.resolve(input)
  : (await readFile(path.resolve(root, "outputs/latest"), "utf8")).trim();

const previewPath = path.join(outputDir, "preview.html");
const renderDir = path.join(outputDir, "render");
await mkdir(renderDir, { recursive: true });

const { chromium } = requireRuntimePackage("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: findInstalledChromium()
});
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: { dir: renderDir, size: { width: 1080, height: 1920 } }
});
const page = await context.newPage();
await page.goto(`${pathToFileURL(previewPath).href}?capture=1`);
await page.waitForFunction(() => window.renderDone === true, null, { timeout: 45000 });
await page.locator("canvas").screenshot({ path: path.join(outputDir, "cover.png") });
const video = page.video();
await context.close();
await browser.close();

const webmPath = path.join(outputDir, "video.webm");
const tempVideoPath = await video.path();
await rename(tempVideoPath, webmPath);

const ffmpegPath = findFfmpeg();
const mp4Path = path.join(outputDir, "video.mp4");
let mp4Status = "skipped_missing_ffmpeg";
let mp4Error = null;
if (ffmpegPath) {
  try {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", webmPath,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-movflags", "+faststart",
      mp4Path
    ]);
    mp4Status = "rendered";
  } catch (error) {
    mp4Status = "skipped_ffmpeg_lacks_mp4";
    mp4Error = error.stderr?.split("\n").slice(-4).join("\n") ?? error.message;
  }
}

await writeFile(path.join(outputDir, "render-status.json"), JSON.stringify({
  status: "rendered",
  format: mp4Status === "rendered" ? "mp4" : "webm",
  videoPath: webmPath,
  mp4Path: mp4Status === "rendered" ? mp4Path : null,
  coverPath: path.join(outputDir, "cover.png"),
  mp4Status,
  mp4Error
}, null, 2), "utf8");

console.log(`Rendered WebM: ${webmPath}`);
if (mp4Status === "rendered") {
  console.log(`Rendered MP4: ${mp4Path}`);
}
console.log(`Cover image: ${path.join(outputDir, "cover.png")}`);

function findInstalledChromium() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function findFfmpeg() {
  const localAppData = process.env.LOCALAPPDATA;
  const candidates = [
    findWingetFfmpeg(),
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
    localAppData && path.join(localAppData, "ms-playwright", "ffmpeg-1011", "ffmpeg-win64.exe")
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function findWingetFfmpeg() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  const packagesDir = path.join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!existsSync(packagesDir)) return null;
  const packageDir = readdirSync(packagesDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith("Gyan.FFmpeg"));
  if (!packageDir) return null;
  return path.join(packagesDir, packageDir.name, "ffmpeg-9.0-full_build", "bin", "ffmpeg.exe");
}
