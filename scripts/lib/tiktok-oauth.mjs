import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { requireEnv } from "./env.mjs";

export function buildAuthorizeUrl({ state, codeChallenge }) {
  const clientKey = requireEnv("TIKTOK_CLIENT_KEY");
  const redirectUri = requireEnv("TIKTOK_REDIRECT_URI");
  const scopes = process.env.TIKTOK_SCOPES ?? "user.info.basic,user.info.stats,video.list,video.upload";
  const query = [
    ["client_key", clientKey],
    ["scope", scopes],
    ["response_type", "code"],
    ["redirect_uri", redirectUri],
    ["state", state],
    ["code_challenge", codeChallenge],
    ["code_challenge_method", "S256"]
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return {
    href: `https://www.tiktok.com/v2/auth/authorize/?${query.join("&").replaceAll("%2C", ",")}`
  };
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("hex");
  return { verifier, challenge };
}

export function createState() {
  return crypto.randomBytes(24).toString("hex");
}

export async function exchangeCodeForToken({ code, codeVerifier }) {
  const body = new URLSearchParams({
    client_key: requireEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: requireEnv("TIKTOK_REDIRECT_URI"),
    code_verifier: codeVerifier
  });

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache"
    },
    body
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`TikTok token exchange failed: ${JSON.stringify(data)}`);
  }
  return addTokenTimes(data);
}

export async function refreshAccessToken(root, token) {
  const body = new URLSearchParams({
    client_key: requireEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache"
    },
    body
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data)}`);
  }
  const refreshed = addTokenTimes(data);
  await saveToken(root, refreshed);
  return refreshed;
}

export async function getValidAccessToken(root) {
  const token = await readToken(root);
  if (Date.now() < token.expires_at - 5 * 60 * 1000) {
    return token.access_token;
  }
  return (await refreshAccessToken(root, token)).access_token;
}

export async function saveToken(root, token) {
  const tokenPath = getTokenPath(root);
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${JSON.stringify(token, null, 2)}\n`, "utf8");
}

export async function readToken(root) {
  const tokenPath = getTokenPath(root);
  if (!existsSync(tokenPath)) {
    throw new Error("TikTok is not connected yet. Run: node scripts/tiktok-connect.mjs");
  }
  return JSON.parse(await readFile(tokenPath, "utf8"));
}

function addTokenTimes(token) {
  const now = Date.now();
  return {
    ...token,
    obtained_at: new Date(now).toISOString(),
    expires_at: now + token.expires_in * 1000,
    refresh_expires_at: now + token.refresh_expires_in * 1000
  };
}

function getTokenPath(root) {
  return path.join(root, ".tokens", "tiktok.json");
}
