import http from "node:http";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { loadEnv } from "./lib/env.mjs";
import { buildAuthorizeUrl, createPkcePair, createState, exchangeCodeForToken, saveToken } from "./lib/tiktok-oauth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(root);

const redirectUri = new URL(process.env.TIKTOK_REDIRECT_URI ?? "http://localhost:3000/tiktok/callback");
const port = Number(redirectUri.port || 3000);
const callbackPath = redirectUri.pathname;
const state = createState();
const pkce = createPkcePair();
const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge: pkce.challenge });

if (!["localhost", "127.0.0.1"].includes(redirectUri.hostname)) {
  const pendingPath = path.join(root, ".tokens", "tiktok-pending.json");
  await mkdir(path.dirname(pendingPath), { recursive: true });
  await writeFile(pendingPath, `${JSON.stringify({
    state,
    codeVerifier: pkce.verifier,
    redirectUri: redirectUri.href,
    createdAt: new Date().toISOString()
  }, null, 2)}\n`, "utf8");

  console.log("Open this URL to authorize your TikTok account:");
  console.log(authorizeUrl.href);
  console.log("");
  console.log("After TikTok redirects to GitHub Pages, copy the full callback URL and run:");
  console.log("node scripts/tiktok-complete.mjs \"PASTE_CALLBACK_URL_HERE\"");
  openBrowser(authorizeUrl.href);
  process.exit(0);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://localhost:${port}`);
    if (requestUrl.pathname !== callbackPath) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const returnedState = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");
    const error = requestUrl.searchParams.get("error");

    if (error) throw new Error(`TikTok authorization failed: ${error}`);
    if (!code) throw new Error("TikTok callback missing authorization code.");
    if (returnedState !== state) throw new Error("TikTok callback state mismatch.");

    const token = await exchangeCodeForToken({ code, codeVerifier: pkce.verifier });
    await saveToken(root, token);

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<h1>TikTok connected</h1><p>You can close this tab and return to Codex.</p>");
    console.log("TikTok connected. Token saved locally in .tokens/tiktok.json");
    server.close();
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
    console.error(error.message);
    server.close();
  }
});

server.listen(port, () => {
  console.log(`Listening for TikTok callback on ${redirectUri.href}`);
  console.log("Open this URL to authorize your TikTok account:");
  console.log(authorizeUrl.href);
  openBrowser(authorizeUrl.href);
});

function openBrowser(url) {
  if (process.platform !== "win32") return;
  execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
}
