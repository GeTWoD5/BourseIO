# Auto TikTok Stock Video Factory

MVP pour automatiser un format de vidéo type `@les_tendances_boursieres`:

1. brief de sujet,
2. génération de données,
3. narration,
4. scènes vidéo,
5. preview verticale,
6. rendu vidéo WebM,
7. caption + hashtags,
8. payload TikTok prêt pour l'API officielle.

## Pré-requis

- Node.js 20+.
- Google Chrome ou Microsoft Edge installé localement.
- `ffmpeg` si tu veux générer automatiquement le MP4 final.
- Une app TikTok Developer configurée si tu veux connecter un compte et publier.

## Installation

```powershell
npm install
npm run setup:browsers
copy .env.example .env
```

Complète ensuite le fichier `.env` avec tes propres identifiants TikTok.

## Lancer l'exemple

```powershell
node scripts/generate.mjs briefs/sample-airbus.json
node scripts/render-video.mjs outputs/latest
```

Les fichiers générés arrivent dans `outputs/<date>-<sujet>-<mode>/`.

## Créer une vidéo pour un nouveau sujet

```powershell
node scripts/new-brief.mjs --name NVIDIA --ticker NVDA --amount 1000 --start 2019-01-02
node scripts/pipeline.mjs briefs/nvidia-lump_sum.json
```

Pour un investissement mensuel:

```powershell
node scripts/new-brief.mjs --name Michelin --ticker ML.PA --mode monthly_dca --monthly 100 --start 2014-01-02
node scripts/pipeline.mjs briefs/michelin-monthly_dca.json
```

## Fichiers importants

- `briefs/sample-airbus.json`: sujet d'entrée.
- `config/factory.json`: réglages vidéo, style et données.
- `templates/preview.html`: rendu vertical animé.
- `scripts/generate.mjs`: fabrique brief, données, scènes, caption et payload.
- `scripts/new-brief.mjs`: crée un brief depuis un sujet donné.
- `scripts/pipeline.mjs`: lance génération, rendu et préparation publication.
- `scripts/render-video.mjs`: rend une vidéo WebM et une image de couverture via navigateur.
- `scripts/publish-tiktok.mjs`: connecteur TikTok officiel à finaliser avec token, URL vidéo et app auditée.

## Sorties générées

- `preview.html`: aperçu animé ouvrable dans un navigateur.
- `cover.png`: image de couverture.
- `video.webm`: rendu vidéo local.
- `caption.txt`: description + hashtags.
- `publish-payload.json`: payload TikTok.
- `market.json`: données normalisées.
- `scenes.json`: timeline vidéo complète.

## Publication TikTok

La publication directe publique demande une app TikTok Developer correctement configurée et auditée.

Configure d'abord `.env` à partir de `.env.example`, puis connecte ton compte:

```powershell
node scripts/tiktok-connect.mjs
```

Vérifie ensuite que TikTok reconnaît le compte autorisé:

```powershell
node scripts/tiktok-status.mjs
```

Pour envoyer la dernière vidéo générée:

```powershell
node scripts/publish-tiktok.mjs outputs/latest
```

Variables utiles:

- `TIKTOK_CLIENT_KEY`: Client Key de l'app TikTok Developer.
- `TIKTOK_CLIENT_SECRET`: Client Secret de l'app TikTok Developer.
- `TIKTOK_REDIRECT_URI`: URI OAuth locale.
- `TIKTOK_SCOPES`: `user.info.basic,video.upload` ou `user.info.basic,video.publish`.
- `TIKTOK_POST_MODE`: `draft` ou `direct`.
- `VIDEO_PATH`: chemin local du MP4 final si besoin.

## Fichiers exclus du dépôt

Pour éviter tout risque de sécurité ou de bruit inutile, le dépôt ne doit pas contenir:

- `.env`
- `.tokens/`
- `outputs/`
- `node_modules/`

## Prochaine étape technique

Ajouter un encodeur H.264/MP4 avec `ffmpeg`, puis convertir automatiquement `video.webm` ou les frames vers `video.mp4` avant publication.
