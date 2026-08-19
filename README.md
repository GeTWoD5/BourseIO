# Bourse.IO Studio

Bourse.IO Studio prepares vertical stock-market videos for TikTok from a simple theme. It runs only on the home PC: market data, video rendering, French voice-over, subtitles, queue, and TikTok handoff stay local.

## Everyday workflow

The cockpit is the recommended interface. It offers market-driven ideas, a production queue, several editorial angles, and an automatic weekday schedule.

```powershell
npm run dashboard
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Use the cockpit to:

1. Select a suggested theme or enter a stock name and ticker.
2. Select an angle: investment POV, market movement, or historical recap.
3. Add it to the queue. The studio generates and validates the final video.
4. Review the ready-to-post item, approve it, then choose a publication time. TikTok stays in draft mode until you explicitly authorize a scheduled or manual send.

## Editorial calendar and approval

Use **Production planifiee** when creating a video to place its rendering on a future date. The seven-day calendar shows automatic production slots, planned renders, and approved publication times.

When a render is ready, use **Approuver et programmer**. This creates an explicit publication authorization only after every technical and data check has passed. A scheduled publication is sent only at the selected time and only when TikTok is connected. Re-rendering a video resets its approval, so changed media must be approved again.

The automatic pilot is enabled by default on weekdays at **08:30**. It cycles through a large editorial catalogue and offers ten refreshed suggestions at a time. If every recent idea has been used, it keeps rotating instead of running out. Schedule, pause, and draft/direct mode are configurable in the **Pilote automatique** card.

## Result of each production

Each folder in `outputs/<date>-<subject>-<mode>/` contains:

- `video.mp4`: H.264 / AAC vertical video compatible with TikTok.
- `video.webm`: local browser render.
- `voiceover.wav`: French voice-over made locally with Windows voices.
- `subtitles.srt`: synchronized subtitle file.
- `cover.png`, `caption.txt`, and `publish-payload.json`.
- `market.json`, `scenes.json`, and `render-status.json` for traceability.

Immediately after rendering, the delivery gate inspects H.264, 1080x1920, yuv420p, AAC audio, duration, local voice-over, subtitles, and cover. It then checks market data and caption. A video cannot be published unless every check has passed. You can run the technical inspection manually with `npm run inspect -- outputs/latest`.

## From the work PC with VS Code Remote SSH

Connect VS Code to `getwod@100.75.192.65`, then open:

```text
C:\Users\GeTWoD\Documents\ChatGPT\Bourse.IO
```

In the **Ports** tab, open port `3847` labelled **Bourse.IO Studio**. VS Code securely forwards the cockpit to the browser on the work PC. The service itself remains bound to the home PC only.

The studio starts automatically when the home PC session opens. If you need to start it manually, run `npm run dashboard`; if port 3847 is already occupied, it is simply already running.

## Manual creation

```powershell
node scripts/new-brief.mjs --name NVIDIA --ticker NVDA --amount 1000 --start 2019-01-02 --template market_momentum
node scripts/pipeline.mjs briefs/nvidia-lump_sum.json
```

Available templates: `pov_investment_growth`, `market_momentum`, and `performance_recap`. The `monthly_dca` investment mode automatically uses the DCA format.

## Setup

```powershell
npm install
npm run setup:browsers
copy .env.example .env
```

A complete local `ffmpeg` must be available from `PATH` for H.264 MP4 output. You can set `FFMPEG_PATH` in `.env` to point at a specific `ffmpeg.exe`.

## TikTok

TikTok publishing needs an approved TikTok Developer app and valid credentials in `.env`:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_SCOPES` - include `user.info.basic,user.info.stats,video.list,video.upload` for the dashboard stats panel.

The project uses the official connection workflow. Once TikTok approves the requested scopes and you reconnect, the dashboard can show followers, account likes, recent video views, and engagement. TikTok's Display API supplies these account and public-video metrics. Until the app is approved and the account is connected, videos remain local and ready in the queue. Automatic publication is off by default and must be enabled in the cockpit only when you are ready.

## Local and private files

Do not commit `.env`, `.tokens/`, `outputs/`, or `node_modules/`. The queue and generated briefs are under `outputs/.dashboard/` and remain local.
