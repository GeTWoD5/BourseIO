import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const briefPath = process.argv[2] ?? "briefs/sample-airbus.json";

await run("node", ["scripts/generate.mjs", briefPath]);
await run("node", ["scripts/render-video.mjs", "outputs/latest"]);
await run("node", ["scripts/publish-tiktok.mjs", "outputs/latest"]);

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { windowsHide: true });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}
