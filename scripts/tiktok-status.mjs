import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { getValidAccessToken } from "./lib/tiktok-oauth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(root);
const accessToken = await getValidAccessToken(root);

const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8"
  }
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
