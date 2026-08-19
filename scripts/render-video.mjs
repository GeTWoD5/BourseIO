import path from "node:path";
import { existsSync } from "node:fs";
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

const voiceoverTextPath = path.join(outputDir, "voiceover.txt");
const voiceoverPath = path.join(outputDir, "voiceover.wav");
let voiceStatus = "skipped_missing_voiceover";
let voiceError = null;
if (existsSync(voiceoverTextPath)) {
  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", path.join(root, "scripts", "render-voiceover.ps1"),
      "-TextPath", voiceoverTextPath,
      "-OutputPath", voiceoverPath
    ], { windowsHide: true });
    voiceStatus = existsSync(voiceoverPath) ? "rendered" : "skipped_empty_voiceover";
  } catch (error) {
    voiceStatus = "skipped_voice_engine_error";
    voiceError = error.stderr?.split("\n").slice(-4).join("\n") ?? error.message;
  }
}

const ffmpegPath = findFfmpeg();
const mp4Path = path.join(outputDir, "video.mp4");
let mp4Status = "skipped_missing_ffmpeg";
let mp4Error = null;
if (ffmpegPath) {
  try {
    const args = ["-y", "-i", webmPath];
    if (voiceStatus === "rendered") {
      args.push("-i", voiceoverPath, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "160k", "-shortest");
    }
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4Path);
    await execFileAsync(ffmpegPath, args);
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
  mp4Error,
  voicePath: voiceStatus === "rendered" ? voiceoverPath : null,
  voiceStatus,
  voiceError
}, null, 2), "utf8");

console.log(`Rendered WebM: ${webmPath}`);
if (mp4Status === "rendered") {
  console.log(`Rendered MP4: ${mp4Path}`);
}
if (voiceStatus === "rendered") {
  console.log(`Rendered voiceover: ${voiceoverPath}`);
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
  // Playwright ships a capture helper named ffmpeg, but it cannot encode H.264.
  // Use a full local ffmpeg from PATH, or let the user override it explicitly.
  return process.env.FFMPEG_PATH ?? (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}
