import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

await run("node", ["scripts/generate.mjs", "briefs/nvidia-lump_sum.json"]);
await run("node", ["scripts/render-video.mjs", "outputs/latest"]);
await run("node", ["scripts/tiktok-status.mjs"]);

console.log("");
console.log("Review demo is ready.");
console.log("Generated video: outputs/latest -> video.mp4");
console.log("Generated caption: outputs/latest -> caption.txt");
console.log("To demonstrate the unaudited Direct Post block, set TIKTOK_POST_MODE=direct and run:");
console.log("node scripts/publish-tiktok.mjs outputs/latest");

async function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const { stdout, stderr } = await execFileAsync(command, args, { windowsHide: true });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}
