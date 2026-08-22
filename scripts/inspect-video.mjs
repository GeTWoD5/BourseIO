import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? path.join(root, "outputs", "latest");
const outputDir = existsSync(input) && !input.endsWith("latest")
  ? path.resolve(input)
  : (await readFile(path.join(root, "outputs", "latest"), "utf8")).trim();
const videoPath = path.join(outputDir, "video.mp4");
const coverPath = path.join(outputDir, "cover.png");

const checks = [];
let probe = null;
try {
  const ffprobe = process.env.FFPROBE_PATH ?? (process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath], { windowsHide: true });
  probe = JSON.parse(stdout);
} catch (error) {
  checks.push({ name: "Analyse technique ffprobe", passed: false, detail: error.message });
}

if (probe) {
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(probe.format?.duration);
  checks.push({ name: "Codec video H.264", passed: video?.codec_name === "h264", detail: video?.codec_name ?? "absent" });
  checks.push({ name: "Format vertical 1080x1920", passed: video?.width === 1080 && video?.height === 1920, detail: video ? `${video.width}x${video.height}` : "absent" });
  checks.push({ name: "Pixel format TikTok", passed: video?.pix_fmt === "yuv420p", detail: video?.pix_fmt ?? "absent" });
  checks.push({ name: "Duree adaptee", passed: Number.isFinite(duration) && duration >= 12 && duration <= 75, detail: Number.isFinite(duration) ? `${duration.toFixed(1)} s` : "inconnue" });
}

checks.push({ name: "Couverture exportee", passed: existsSync(coverPath) && statSync(coverPath).size > 5_000, detail: existsSync(coverPath) ? `${Math.round(statSync(coverPath).size / 1024)} KB` : "absente" });

const report = {
  passed: checks.every((check) => check.passed),
  checkedAt: new Date().toISOString(),
  videoPath,
  checks,
  warnings: checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`)
};
await writeFile(path.join(outputDir, "video-quality.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 2;
