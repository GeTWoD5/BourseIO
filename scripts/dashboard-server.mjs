import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildAuthorizeUrl, createPkcePair, createState, exchangeCodeForToken, getValidAccessToken, saveToken } from "./lib/tiktok-oauth.mjs";
import { loadEnv } from "./lib/env.mjs";
import { slugify } from "./lib/fs-utils.mjs";
import { DEFAULT_STUDIO_SETTINGS, assessVideoQuality, buildEditorialSuggestions, createStudioBrief } from "./lib/studio-automation.mjs";
import { fetchTikTokMetrics } from "./lib/tiktok-metrics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboardDir = path.join(root, "dashboard");
const dataDir = path.join(root, "outputs", ".dashboard");
const queuePath = path.join(dataDir, "queue.json");
const settingsPath = path.join(dataDir, "studio-settings.json");
const port = Number(process.env.DASHBOARD_PORT ?? 3847);
const host = process.env.DASHBOARD_HOST ?? "0.0.0.0";
let activeJobId = null;
let suggestionCache = { value: null, updatedAt: 0 };
let suggestionOffset = 0;
let metricsCache = { value: null, updatedAt: 0 };

await loadEnv(root);
await mkdir(path.join(dataDir, "briefs"), { recursive: true });

const suggestions = [
  { name: "Airbus", ticker: "AIR.PA", sector: "aéronautique", startDate: "2016-01-04", angle: "Et si tu avais investi 1 000 € dans Airbus il y a 10 ans ?" },
  { name: "NVIDIA", ticker: "NVDA", sector: "semi-conducteurs", startDate: "2019-01-02", angle: "NVIDIA : ce qu'un investissement de long terme aurait donné." },
  { name: "LVMH", ticker: "MC.PA", sector: "luxe", startDate: "2015-01-02", angle: "LVMH : le luxe a-t-il vraiment créé de la valeur ?" },
  { name: "ASML", ticker: "ASML", sector: "semi-conducteurs", startDate: "2016-01-04", angle: "ASML : l'action indispensable aux puces modernes." },
  { name: "Michelin", ticker: "ML.PA", sector: "industrie", startDate: "2014-01-02", angle: "100 € par mois sur Michelin : quel résultat ?" },
  { name: "TotalEnergies", ticker: "TTE.PA", sector: "énergie", startDate: "2016-01-04", angle: "TotalEnergies : dividendes et performance sur 10 ans." }
];

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/dashboard") return sendJson(response, await snapshot());
    if (request.method === "POST" && url.pathname === "/api/jobs") return createJob(request, response);
    if (request.method === "POST" && url.pathname === "/api/settings") return updateStudioSettings(request, response);
    if (request.method === "POST" && url.pathname === "/api/automation/run") return runAutomationRoute(response);
    if (request.method === "POST" && url.pathname === "/api/suggestions/refresh") return refreshSuggestions(response);
    if (request.method === "POST" && url.pathname === "/api/tiktok/metrics/refresh") return refreshTikTokMetrics(response);
    if (request.method === "POST" && /^\/api\/jobs\/[^/]+\/run$/.test(url.pathname)) return runJobRoute(request, response, jobIdFrom(url.pathname));
    if (request.method === "POST" && /^\/api\/jobs\/[^/]+\/approve$/.test(url.pathname)) return approveJobRoute(request, response, jobIdFrom(url.pathname));
    if (request.method === "POST" && /^\/api\/jobs\/[^/]+\/export$/.test(url.pathname)) return exportInfoRoute(response, jobIdFrom(url.pathname));
    if (request.method === "POST" && /^\/api\/jobs\/[^/]+\/publish$/.test(url.pathname)) return publishJobRoute(request, response, jobIdFrom(url.pathname));
    if (request.method === "DELETE" && /^\/api\/jobs\/[^/]+$/.test(url.pathname)) return deleteJob(response, jobIdFrom(url.pathname));
    if (request.method === "POST" && url.pathname === "/api/tiktok/authorize") return startTikTokAuthorization(response);
    if (request.method === "POST" && url.pathname === "/api/tiktok/complete") return completeTikTokAuthorization(request, response);
    if (request.method === "GET" && /^\/media\/[^/]+\/(cover|video)$/.test(url.pathname)) return serveMedia(response, url.pathname);
    if (request.method === "GET") return serveDashboard(response, url.pathname);
    sendJson(response, { error: "Route inconnue." }, 404);
  } catch (error) {
    console.error(error);
    sendJson(response, { error: error.message ?? "Erreur interne." }, 500);
  }
});

server.listen(port, host, () => {
  console.log(`Bourse_IO Studio is ready at http://${host}:${port}`);
  console.log("Keep this terminal running while using the dashboard.");
  void ensureStudioSettings();
  void runAutomationCycle();
  void runPlannedProductions();
  setInterval(() => { void runAutomationCycle(); void runPlannedProductions(); }, 30 * 1000);
});

async function snapshot() {
  const queue = await readQueue();
  const settings = await readStudioSettings();
  return {
    app: { name: "Bourse_IO Studio", port },
    tiktok: await tiktokState(),
    settings,
    suggestions: await currentSuggestions(queue.jobs),
    metrics: await currentTikTokMetrics(),
    calendar: buildEditorialCalendar(queue.jobs, settings),
    jobs: queue.jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

async function createJob(request, response) {
  const input = await readBody(request);
  const name = cleanText(input.name, 80);
  const ticker = cleanText(input.ticker, 24).toUpperCase();
  if (!name || !ticker) return sendJson(response, { error: "Le nom et le ticker sont obligatoires." }, 400);
  const mode = input.mode === "monthly_dca" ? "monthly_dca" : "lump_sum";
  const amount = positiveNumber(input.amount, 1000);
  const productionAt = scheduledDate(input.productionAt);
  const job = {
    id: crypto.randomUUID(),
    status: productionAt && new Date(productionAt).getTime() > Date.now() ? "planned" : "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: name,
    autoPublish: false,
    publishMode: input.publishMode === "direct" ? "direct" : "draft",
    brief: {
      niche: "stock_market",
      template: ["pov_investment_growth", "market_momentum", "performance_recap"].includes(input.template) ? input.template : "pov_investment_growth",
      subject: { name, ticker, sector: cleanText(input.sector, 50) || "bourse" },
      investment: {
        mode,
        amount,
        ...(mode === "monthly_dca" ? { monthlyAmount: positiveNumber(input.monthlyAmount, 100) } : {}),
        currency: "EUR",
        startDate: validDate(input.startDate) ?? "2020-01-02",
        endDate: new Date().toISOString().slice(0, 10)
      },
      language: "fr",
      tone: ["curiosity", "educational", "punchy"].includes(input.tone) ? input.tone : "curiosity",
      brand: { accountName: "Bourse_IO", seriesTag: "bourseio" },
      publishing: {
        visibility: input.visibility === "SELF_ONLY" ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE",
        allowComments: true,
        allowDuet: false,
        allowStitch: false
      }
    },
    log: [productionAt ? `Production planifiee pour ${productionAt}.` : "Ajoutee a la file."],
    planning: { productionAt },
    review: { status: "pending", approvedAt: null, scheduledFor: null, publishOnSchedule: false },
    outputDir: null,
    preview: null,
    publish: null,
    error: null
  };
  const queue = await readQueue();
  queue.jobs.push(job);
  await writeQueue(queue);
  sendJson(response, { job }, 201);
}

async function runJobRoute(_request, response, id) {
  const queue = await readQueue();
  const job = queue.jobs.find((item) => item.id === id);
  if (!job) return sendJson(response, { error: "Vidéo introuvable." }, 404);
  if (activeJobId) return sendJson(response, { error: "Une génération est déjà en cours. La file attend sa fin." }, 409);
  if (!["planned", "queued", "failed", "ready"].includes(job.status)) return sendJson(response, { error: "Cette video est deja en cours de traitement." }, 409);
  activeJobId = id;
  job.status = "generating";
  job.error = null;
  job.updatedAt = new Date().toISOString();
  job.log.push("Génération lancée.");
  await writeQueue(queue);
  void processJob(id).finally(() => { activeJobId = null; });
  sendJson(response, { ok: true, jobId: id });
}

async function processJob(id) {
  try {
    const job = await updateJob(id, (item) => item);
    const briefPath = path.join(dataDir, "briefs", `${job.id}.json`);
    await writeFile(briefPath, `${JSON.stringify(job.brief, null, 2)}\n`, "utf8");
    const tag = job.id.slice(0, 8);
    const generated = await runNode(["scripts/generate.mjs", briefPath], { BOURSE_OUTPUT_TAG: tag });
    await appendLog(id, generated);
    const outputDir = (await readFile(path.join(root, "outputs", "latest"), "utf8")).trim();
    await updateJob(id, (item) => ({ ...item, status: "rendering", outputDir, updatedAt: new Date().toISOString(), log: [...item.log, "Rendu vidéo MP4 en cours."] }));
    const rendered = await runNode(["scripts/render-video.mjs", outputDir]);
    await appendLog(id, rendered);
    await updateJob(id, (item) => ({ ...item, status: "quality_gate", updatedAt: new Date().toISOString(), log: [...item.log, "Technical quality gate: MP4, format vertical et couverture."] }));
    const inspected = await runNode(["scripts/inspect-video.mjs", outputDir]);
    await appendLog(id, inspected);
    await updateJob(id, (item) => ({ ...item, status: "verifying", updatedAt: new Date().toISOString(), log: [...item.log, "Market data verification."] }));
    const verified = await runNode(["scripts/verify-market-data.mjs", outputDir]);
    await appendLog(id, verified);
    const [caption, renderStatus, market, deliveryQuality] = await Promise.all([
      readFile(path.join(outputDir, "caption.txt"), "utf8"),
      readJsonOptional(path.join(outputDir, "render-status.json")),
      readJsonOptional(path.join(outputDir, "market.json")),
      readJsonOptional(path.join(outputDir, "video-quality.json"))
    ]);
    const quality = assessVideoQuality({ market, caption, renderStatus, deliveryQuality });
    const ready = await updateJob(id, (item) => ({
      ...item,
      status: quality.passed ? "ready" : "failed",
      updatedAt: new Date().toISOString(),
      quality,
      deliveryQuality,
      review: { status: "pending", approvedAt: null, scheduledFor: null, publishOnSchedule: false },
      preview: {
        caption: caption.trim(),
        performancePct: market?.performancePct ?? null,
        finalValue: market?.finalValue ?? null,
        currency: market?.currency ?? "EUR",
        hasMp4: renderStatus?.mp4Status === "rendered"
      },
      error: quality.passed ? null : "Quality gate blocked the video.",
      log: [...item.log, quality.passed ? "Video validated and ready for TikTok." : "Quality gate failed: video blocked."]
    }));
    // Publishing is always a separate approval step, even when auto production is enabled.
  } catch (error) {
    await updateJob(id, (item) => ({ ...item, status: "failed", error: error.message, updatedAt: new Date().toISOString(), log: [...item.log, `Erreur : ${error.message}`] }));
  }
}

async function approveJobRoute(request, response, id) {
  try {
    const input = await readBody(request);
    const job = await findJob(id);
    if (job.status !== "ready" || !job.quality?.passed) throw new Error("La video doit etre prete et validee avant approbation.");
    const review = {
      status: "approved",
      approvedAt: new Date().toISOString(),
      scheduledFor: null,
      publishOnSchedule: false
    };
    const updated = await updateJob(id, (item) => ({ ...item, review, updatedAt: new Date().toISOString(), log: [...item.log, "Vidéo approuvée : l'envoi TikTok reste manuel et nécessite un consentement explicite."] }));
    sendJson(response, { job: updated });
  } catch (error) {
    sendJson(response, { error: error.message }, 400);
  }
}

async function exportInfoRoute(response, id) {
  try {
    const job = await findJob(id);
    if (job.status !== "ready" || !job.quality?.passed || !job.review?.approvedAt) throw new Error("Approuvez la vidéo validée avant de préparer son export TikTok.");
    if (!(await tiktokState()).connected) throw new Error("Connectez un compte TikTok avant l'export.");
    const creator = await queryCreatorInfo();
    const duration = await videoDurationSeconds(path.join(job.outputDir, "video.mp4"));
    sendJson(response, {
      job: publicJob(job),
      creator,
      duration,
      privateDirectPostsOnly: requiresPrivateDirectPosts()
    });
  } catch (error) {
    sendJson(response, { error: error.message }, 400);
  }
}

async function publishJobRoute(request, response, id) {
  try {
    const job = await publishJob(id, await readBody(request));
    sendJson(response, { job });
  } catch (error) {
    sendJson(response, { error: error.message }, 400);
  }
}

async function publishJob(id, postInfo) {
  const job = await findJob(id);
  if (job.status !== "ready" || !job.quality?.passed) throw new Error("The video must pass quality control before publication.");
  if (!job.review?.approvedAt) throw new Error("Approve the video before publication.");
  if (postInfo?.expressConsent !== true) throw new Error("Le consentement explicite du créateur est requis avant tout envoi TikTok.");
  const deliveryQuality = await readJsonOptional(path.join(job.outputDir, "video-quality.json"));
  if (!deliveryQuality?.passed) throw new Error("The technical delivery report is missing or invalid.");
  const state = await tiktokState();
  if (!state.connected) throw new Error("Connect TikTok once before sending a video.");
  const mode = postInfo?.mode === "draft" ? "draft" : "direct";
  let normalized = null;
  if (mode === "direct") {
    const creator = await queryCreatorInfo();
    normalized = validatePostInfo(postInfo, creator);
    const duration = await videoDurationSeconds(path.join(job.outputDir, "video.mp4"));
    if (duration > creator.max_video_post_duration_sec) throw new Error("La vidéo dépasse la durée autorisée par ce compte TikTok.");
    await writeFile(path.join(job.outputDir, "publish-payload.json"), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }
  await updateJob(id, (item) => ({ ...item, status: "publishing", updatedAt: new Date().toISOString(), review: { ...item.review, exportedAt: new Date().toISOString(), mode, postInfo: normalized }, log: [...item.log, mode === "draft" ? "Consentement confirmé : envoi du brouillon TikTok lancé." : "Consentement confirmé : publication directe TikTok lancée."] }));
  try {
    const output = await runNode(["scripts/publish-tiktok.mjs", job.outputDir], { TIKTOK_POST_MODE: mode });
    const result = await readJsonOptional(path.join(job.outputDir, "publish-status.json"));
    const receipt = mode === "draft" ? "TikTok a reçu le brouillon. Ouvrez la notification TikTok pour l'éditer et le publier." : "TikTok a reçu la vidéo. Son traitement peut prendre quelques minutes.";
    return updateJob(id, (item) => ({ ...item, status: "published", updatedAt: new Date().toISOString(), publish: result, log: [...item.log, output, receipt] }));
  } catch (error) {
    await updateJob(id, (item) => ({ ...item, status: "ready", error: error.message, updatedAt: new Date().toISOString(), log: [...item.log, `Échec d'envoi : ${error.message}`] }));
    throw error;
  }
}

async function deleteJob(response, id) {
  const queue = await readQueue();
  const index = queue.jobs.findIndex((item) => item.id === id);
  if (index === -1) return sendJson(response, { error: "Vidéo introuvable." }, 404);
  if (queue.jobs[index].status === "generating" || queue.jobs[index].status === "rendering") return sendJson(response, { error: "Impossible de supprimer pendant le rendu." }, 409);
  const [job] = queue.jobs.splice(index, 1);
  await writeQueue(queue);
  await rm(path.join(dataDir, "briefs", `${job.id}.json`), { force: true });
  sendJson(response, { ok: true });
}

async function runPlannedProductions() {
  if (activeJobId) return null;
  const queue = await readQueue();
  const due = queue.jobs.find((job) => job.status === "planned" && job.planning?.productionAt && new Date(job.planning.productionAt).getTime() <= Date.now());
  if (!due) return null;
  activeJobId = due.id;
  await updateJob(due.id, (item) => ({ ...item, status: "generating", error: null, updatedAt: new Date().toISOString(), log: [...item.log, "Production planifiee lancee."] }));
  void processJob(due.id).finally(() => { activeJobId = null; });
  return due;
}

function buildEditorialCalendar(jobs, settings) {
  const slots = [];
  const now = new Date();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + offset);
    const key = day.toISOString().slice(0, 10);
    const items = [];
    if (settings.automationEnabled && settings.schedule.days.includes(day.getDay())) items.push({ type: "automation", time: `${String(settings.schedule.hour).padStart(2, "0")}:${String(settings.schedule.minute).padStart(2, "0")}`, title: "Pilote automatique" });
    for (const job of jobs) {
      const productionAt = job.planning?.productionAt;
      const scheduledFor = job.review?.scheduledFor;
      if (productionAt?.slice(0, 10) === key) items.push({ type: "production", time: formatTime(productionAt), title: job.title, jobId: job.id });
      if (scheduledFor?.slice(0, 10) === key) items.push({ type: "publication", time: formatTime(scheduledFor), title: job.title, jobId: job.id });
    }
    slots.push({ date: key, label: day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }), items: items.sort((a, b) => a.time.localeCompare(b.time)) });
  }
  return slots;
}

function scheduledDate(value) {
  const parsed = new Date(String(value ?? ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
function formatTime(value) { return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

async function startTikTokAuthorization(response) {
  if (!hasTikTokConfig()) return sendJson(response, { error: "Renseigne TIKTOK_CLIENT_SECRET dans .env avant de connecter TikTok." }, 400);
  const state = createState();
  const pkce = createPkcePair();
  const pendingPath = path.join(root, ".tokens", "tiktok-pending.json");
  await mkdir(path.dirname(pendingPath), { recursive: true });
  await writeFile(pendingPath, `${JSON.stringify({ state, codeVerifier: pkce.verifier, createdAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  sendJson(response, { authorizeUrl: buildAuthorizeUrl({ state, codeChallenge: pkce.challenge }).href });
}

async function completeTikTokAuthorization(request, response) {
  const { callbackUrl } = await readBody(request);
  const pendingPath = path.join(root, ".tokens", "tiktok-pending.json");
  if (!existsSync(pendingPath)) return sendJson(response, { error: "Commence d'abord la connexion TikTok." }, 400);
  const pending = JSON.parse(await readFile(pendingPath, "utf8"));
  const callback = new URL(String(callbackUrl ?? "").trim());
  const code = callback.searchParams.get("code");
  if (!code || callback.searchParams.get("state") !== pending.state) return sendJson(response, { error: "Le lien de retour TikTok est invalide ou expiré." }, 400);
  const token = await exchangeCodeForToken({ code, codeVerifier: pending.codeVerifier });
  await saveToken(root, token);
  await rm(pendingPath, { force: true });
  sendJson(response, { ok: true, tiktok: await tiktokState() });
}

async function serveMedia(response, pathname) {
  const [, , id, kind] = pathname.split("/");
  const job = await findJob(id);
  if (!job?.outputDir) return sendJson(response, { error: "Média introuvable." }, 404);
  const filePath = path.join(job.outputDir, kind === "cover" ? "cover.png" : "video.mp4");
  if (!existsSync(filePath)) return sendJson(response, { error: "Média indisponible." }, 404);
  response.writeHead(200, { "Content-Type": kind === "cover" ? "image/png" : "video/mp4", "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(response);
}

async function serveDashboard(response, pathname) {
  const filePath = pathname === "/" ? path.join(dashboardDir, "index.html") : path.resolve(dashboardDir, `.${pathname}`);
  if (!filePath.startsWith(dashboardDir) || !existsSync(filePath)) return sendJson(response, { error: "Page introuvable." }, 404);
  response.writeHead(200, { "Content-Type": filePath.endsWith(".css") ? "text/css; charset=utf-8" : filePath.endsWith(".js") ? "application/javascript; charset=utf-8" : "text/html; charset=utf-8" });
  createReadStream(filePath).pipe(response);
}

async function tiktokState() {
  const tokenPath = path.join(root, ".tokens", "tiktok.json");
  if (!existsSync(tokenPath)) return { connected: false, configured: hasTikTokConfig(), mode: process.env.TIKTOK_POST_MODE ?? "draft" };
  const token = await readJsonOptional(tokenPath);
  return { connected: Boolean(token?.access_token), configured: hasTikTokConfig(), mode: process.env.TIKTOK_POST_MODE ?? "draft", expiresAt: token?.expires_at ? new Date(token.expires_at).toISOString() : null };
}

async function queryCreatorInfo() {
  const accessToken = await getValidAccessToken(root);
  const result = await tiktokPostJson("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", accessToken, {});
  const data = result.data ?? {};
  if (!data.creator_nickname || !Array.isArray(data.privacy_level_options) || !Number.isFinite(Number(data.max_video_post_duration_sec))) {
    throw new Error("TikTok n'a pas renvoyé les paramètres nécessaires pour l'écran d'export.");
  }
  return data;
}

async function tiktokPostJson(url, accessToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || result.error?.code !== "ok") throw new Error(result.error?.message || "TikTok n'a pas accepté cette demande.");
  return result;
}

function validatePostInfo(input, creator) {
  const title = cleanText(input?.title, 2200);
  const privacyLevel = String(input?.privacyLevel ?? "");
  if (!privacyLevel || !creator.privacy_level_options.includes(privacyLevel)) throw new Error("Choisissez une visibilité proposée par TikTok pour ce compte.");
  if (requiresPrivateDirectPosts() && privacyLevel !== "SELF_ONLY") {
    throw new Error("Ce client TikTok n'est pas encore audité : la publication directe doit être réglée sur « Moi uniquement ».");
  }
  const commercial = Boolean(input?.commercial);
  const brandOrganic = commercial && Boolean(input?.brandOrganic);
  const brandContent = commercial && Boolean(input?.brandContent);
  if (commercial && !brandOrganic && !brandContent) throw new Error("Indiquez si la publication promeut votre marque, une marque partenaire, ou les deux.");
  if (brandContent && privacyLevel === "SELF_ONLY") throw new Error("Le contenu de marque partenaire ne peut pas être publié en visibilité privée.");
  return {
    title,
    privacy_level: privacyLevel,
    disable_comment: creator.comment_disabled ? true : !Boolean(input?.allowComment),
    disable_duet: creator.duet_disabled ? true : !Boolean(input?.allowDuet),
    disable_stitch: creator.stitch_disabled ? true : !Boolean(input?.allowStitch),
    brand_content_toggle: brandContent,
    brand_organic_toggle: brandOrganic,
    is_aigc: Boolean(input?.isAigc),
    video_cover_timestamp_ms: 1000
  };
}

function requiresPrivateDirectPosts() {
  return String(process.env.TIKTOK_REQUIRE_PRIVATE_DIRECT_POSTS ?? "").toLowerCase() === "true";
}

async function videoDurationSeconds(videoPath) {
  const { stdout } = await new Promise((resolve, reject) => {
    execFile(process.env.FFPROBE_PATH ?? (process.platform === "win32" ? "ffprobe.exe" : "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath], { windowsHide: true }, (error, output) => error ? reject(error) : resolve({ stdout: output }));
  });
  const duration = Number.parseFloat(stdout);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Impossible de vérifier la durée de la vidéo avant l'export TikTok.");
  return duration;
}

function publicJob(job) {
  return { id: job.id, title: job.title, preview: job.preview, outputDir: job.outputDir };
}

function hasTikTokConfig() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && !process.env.TIKTOK_CLIENT_SECRET.includes("put_your"));
}

async function readQueue() {
  if (!existsSync(queuePath)) return { jobs: [] };
  try { return JSON.parse(await readFile(queuePath, "utf8")); } catch { return { jobs: [] }; }
}

async function writeQueue(queue) {
  await writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

async function findJob(id) {
  const queue = await readQueue();
  const job = queue.jobs.find((item) => item.id === id);
  if (!job) throw new Error("Vidéo introuvable.");
  return job;
}

async function updateJob(id, transform) {
  const queue = await readQueue();
  const index = queue.jobs.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("Vidéo introuvable.");
  queue.jobs[index] = transform(queue.jobs[index]);
  await writeQueue(queue);
  return queue.jobs[index];
}

async function appendLog(id, output) {
  if (!output) return;
  await updateJob(id, (item) => ({ ...item, log: [...item.log, output].slice(-18), updatedAt: new Date().toISOString() }));
}

function runNode(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, args, { cwd: root, windowsHide: true, env: { ...process.env, ...env }, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (error) reject(new Error(output || error.message)); else resolve(output);
    });
    child.on("error", reject);
  });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readJsonOptional(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")); } catch { return null; }
}

function sendJson(response, value, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function jobIdFrom(pathname) { return pathname.split("/")[3]; }
function cleanText(value, limit) { return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, limit); }
function positiveNumber(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null; }

async function ensureStudioSettings() {
  if (!existsSync(settingsPath)) await writeStudioSettings(DEFAULT_STUDIO_SETTINGS);
}

async function readStudioSettings() {
  await ensureStudioSettings();
  const saved = await readJsonOptional(settingsPath) ?? {};
  return { ...DEFAULT_STUDIO_SETTINGS, ...saved, schedule: { ...DEFAULT_STUDIO_SETTINGS.schedule, ...saved.schedule }, defaults: { ...DEFAULT_STUDIO_SETTINGS.defaults, ...saved.defaults } };
}

async function writeStudioSettings(settings) {
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function currentSuggestions(jobs) {
  if (suggestionCache.value && Date.now() - suggestionCache.updatedAt < 15 * 60 * 1000) return suggestionCache.value;
  try { suggestionCache = { value: await buildEditorialSuggestions(jobs, { seed: suggestionOffset, limit: 10 }), updatedAt: Date.now() }; } catch { suggestionCache = { value: suggestions, updatedAt: Date.now() }; }
  return suggestionCache.value;
}

async function refreshSuggestions(response) {
  suggestionOffset += 7;
  suggestionCache = { value: null, updatedAt: 0 };
  const queue = await readQueue();
  sendJson(response, { suggestions: await currentSuggestions(queue.jobs) });
}

async function currentTikTokMetrics(force = false) {
  if (!force && metricsCache.value && Date.now() - metricsCache.updatedAt < 5 * 60 * 1000) return metricsCache.value;
  metricsCache = { value: await fetchTikTokMetrics(root), updatedAt: Date.now() };
  return metricsCache.value;
}

async function refreshTikTokMetrics(response) {
  sendJson(response, { metrics: await currentTikTokMetrics(true) });
}

async function updateStudioSettings(request, response) {
  const input = await readBody(request);
  const current = await readStudioSettings();
  const schedule = input.schedule ?? {};
  const next = {
    ...current,
    automationEnabled: typeof input.automationEnabled === "boolean" ? input.automationEnabled : current.automationEnabled,
    autoPublish: false,
    publishMode: input.publishMode === "direct" ? "direct" : input.publishMode === "draft" ? "draft" : current.publishMode,
    schedule: {
      days: Array.isArray(schedule.days) ? schedule.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : current.schedule.days,
      hour: Number.isInteger(schedule.hour) && schedule.hour >= 0 && schedule.hour <= 23 ? schedule.hour : current.schedule.hour,
      minute: Number.isInteger(schedule.minute) && schedule.minute >= 0 && schedule.minute <= 59 ? schedule.minute : current.schedule.minute
    }
  };
  await writeStudioSettings(next);
  sendJson(response, { settings: next });
}

async function runAutomationRoute(response) {
  try {
    const job = await runAutomationCycle(true);
    sendJson(response, { job, message: job ? "Id?e ajout?e ? la file et production lanc?e." : "Une production est d?j? en cours." });
  } catch (error) {
    sendJson(response, { error: error.message }, 400);
  }
}

async function runAutomationCycle(force = false) {
  const settings = await readStudioSettings();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const scheduledMinute = settings.schedule.hour * 60 + settings.schedule.minute;
  if (!force) {
    if (!settings.automationEnabled || activeJobId || settings.lastAutomationDate === dateKey) return null;
    if (!settings.schedule.days.includes(now.getDay()) || minuteOfDay < scheduledMinute || minuteOfDay > scheduledMinute + 2) return null;
  }
  if (activeJobId) return null;
  const queue = await readQueue();
  const ideas = await currentSuggestions(queue.jobs);
  const idea = ideas.find((candidate) => !candidate.reusedRecently) ?? ideas[0];
  if (!idea) throw new Error("No editorial idea is available.");
  const createdAt = new Date().toISOString();
  const job = {
    id: crypto.randomUUID(), status: "generating", createdAt, updatedAt: createdAt, title: idea.name,
    autoPublish: settings.autoPublish, publishMode: settings.publishMode, source: "scheduled",
    brief: createStudioBrief({ ...idea, template: chooseTemplate(queue.jobs), amount: settings.defaults.amount, tone: settings.defaults.tone, startDate: idea.startDate ?? settings.defaults.startDate }, settings),
    log: [force ? "Production automatique lanc?e manuellement." : "Production planifi?e lanc?e."], outputDir: null, preview: null, publish: null, quality: null, error: null
  };
  queue.jobs.push(job);
  settings.lastAutomationDate = dateKey;
  await Promise.all([writeQueue(queue), writeStudioSettings(settings)]);
  activeJobId = job.id;
  void processJob(job.id).finally(() => { activeJobId = null; });
  return job;
}

function chooseTemplate(jobs) {
  const formats = ["pov_investment_growth", "market_momentum", "performance_recap"];
  const recent = jobs.slice(-3).map((job) => job.brief?.template);
  return formats.find((format) => !recent.includes(format)) ?? formats[0];
}
