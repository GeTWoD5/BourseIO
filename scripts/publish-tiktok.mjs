import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
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

const mode = process.env.TIKTOK_POST_MODE ?? "draft";
const videoPath = process.env.VIDEO_PATH ?? path.join(outputDir, "video.mp4");
const accessToken = await getValidAccessToken(root);

if (!existsSync(videoPath)) {
  throw new Error(`Video file not found: ${videoPath}`);
}

const status = mode === "direct"
  ? await directPost({ accessToken, outputDir, videoPath })
  : await uploadDraft({ accessToken, outputDir, videoPath });

await writeFile(path.join(outputDir, "publish-status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");
console.log(JSON.stringify(status, null, 2));

async function uploadDraft({ accessToken, outputDir, videoPath }) {
  const videoSize = statSync(videoPath).size;
  const initBody = {
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: videoSize,
      total_chunk_count: 1
    }
  };

  const initResult = await postJson("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", accessToken, initBody);
  await uploadVideoFile(initResult.data.upload_url, videoPath, videoSize);

  return {
    status: "submitted_to_tiktok_inbox",
    mode: "draft",
    publish_id: initResult.data.publish_id,
    message: "Open TikTok inbox to finish editing and post the uploaded video.",
    outputDir
  };
}

async function directPost({ accessToken, outputDir, videoPath }) {
  const payload = JSON.parse(await readFile(path.join(outputDir, "publish-payload.json"), "utf8"));
  const videoSize = statSync(videoPath).size;
  const initBody = {
    post_info: payload,
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: videoSize,
      total_chunk_count: 1
    }
  };

  const initResult = await postJson("https://open.tiktokapis.com/v2/post/publish/video/init/", accessToken, initBody);
  await uploadVideoFile(initResult.data.upload_url, videoPath, videoSize);

  return {
    status: "submitted_direct_post",
    mode: "direct",
    publish_id: initResult.data.publish_id,
    privacy_level: payload.privacy_level,
    message: "Direct post submitted. If the app is unaudited, TikTok may restrict visibility to SELF_ONLY.",
    outputDir
  };
}

async function postJson(url, accessToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error?.code !== "ok") {
    throw new Error(`TikTok API failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function uploadVideoFile(uploadUrl, videoPath, videoSize) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoSize),
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`
    },
    body: createReadStream(videoPath),
    duplex: "half"
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`TikTok upload failed: ${response.status} ${responseText}`);
  }
}
