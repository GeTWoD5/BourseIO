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

## Depuis le PC de travail avec VS Code Remote SSH

Connectez VS Code à la machine Linux via son adresse ou son nom Tailscale,
puis ouvrez :

```text
/home/bourseio/BourseIO
```

Dans l'onglet **Ports**, ouvrez le port `3847` intitulé **Bourse.IO Studio**.
VS Code transfère ce port de façon privée vers le navigateur du PC de travail.
Le service reste lié à `127.0.0.1` et n'est donc pas exposé sur le réseau.

Sous Linux, installez l'unité `deploy/linux/bourseio.service` pour que le
studio démarre automatiquement. Les détails sont dans
`deploy/linux/README.md`.

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

Un `ffmpeg` complet doit être disponible dans `PATH` pour produire le MP4
H.264. Vous pouvez définir `FFMPEG_PATH` dans `.env` pour indiquer un binaire
précis. Sous Linux, installez également `espeak-ng` pour la voix off locale,
ou configurez Piper pour une voix plus naturelle.

## TikTok

TikTok publishing needs an approved TikTok Developer app and valid credentials in `.env`:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_SCOPES` - include `user.info.basic,user.info.stats,video.list,video.upload` for the dashboard stats panel.

The project uses the official connection workflow. Once TikTok approves the requested scopes and you reconnect, the dashboard can show followers, account likes, recent video views, and engagement. TikTok's Display API supplies these account and public-video metrics. Until the app is approved and the account is connected, videos remain local and ready in the queue. Automatic publication is off by default and must be enabled in the cockpit only when you are ready.

## Local and private files

Do not commit `.env`, `.tokens/`, `outputs/`, or `node_modules/`. The queue and generated briefs are under `outputs/.dashboard/` and remain local.
