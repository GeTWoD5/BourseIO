import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { getValidAccessToken } from "./lib/tiktok-oauth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(root);

const input = process.argv[2] ?? path.resolve(root, "outputs/latest");
const outputDir = existsSync(input) && !input.endsWith("latest")
  ? path.resolve(input)
  : (await readFile(path.resolve(root, "outputs/latest"), "utf8")).trim();

const storedStatus = JSON.parse(await readFile(path.join(outputDir, "publish-status.json"), "utf8"));
const publishId = process.argv[3] ?? storedStatus.publish_id;
if (!publishId) {
  throw new Error("Missing publish_id. Pass it as the second argument or run publish first.");
}

const accessToken = await getValidAccessToken(root);
const response = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8"
  },
  body: JSON.stringify({ publish_id: publishId })
});

const result = await response.json();
await writeFile(path.join(outputDir, "publish-status-check.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
