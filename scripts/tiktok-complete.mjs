import path from "node:path";
import { readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { exchangeCodeForToken, saveToken } from "./lib/tiktok-oauth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(root);

const callbackInput = process.argv.slice(2).join(" ");
if (!callbackInput) {
  console.log("Usage: node scripts/tiktok-complete.mjs \"https://getwod5.github.io/BourseIO/tiktok-callback.html?code=...&state=...\"");
  process.exit(1);
}

const pendingPath = path.join(root, ".tokens", "tiktok-pending.json");
if (!existsSync(pendingPath)) {
  throw new Error("Missing pending TikTok OAuth state. Run node scripts/tiktok-connect.mjs first.");
}

const pending = JSON.parse(await readFile(pendingPath, "utf8"));
const callbackUrl = new URL(callbackInput.trim());
const code = callbackUrl.searchParams.get("code");
const state = callbackUrl.searchParams.get("state");
const error = callbackUrl.searchParams.get("error");

if (error) throw new Error(`TikTok authorization failed: ${error}`);
if (!code) throw new Error("Callback URL missing code parameter.");
if (state !== pending.state) throw new Error("Callback state does not match pending OAuth state.");

const token = await exchangeCodeForToken({
  code,
  codeVerifier: pending.codeVerifier
});
await saveToken(root, token);
await rm(pendingPath, { force: true });

console.log("TikTok connected. Token saved locally in .tokens/tiktok.json");
