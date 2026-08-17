# Auto TikTok Stock Video Factory

MVP pour automatiser un format de video type `@les_tendances_boursieres`:

1. brief de sujet,
2. generation de donnees,
3. narration,
4. scenes video,
5. preview verticale,
6. rendu video WebM,
7. caption + hashtags,
8. payload TikTok pret pour l'API officielle.

## Lancer l'exemple

```powershell
node scripts/generate.mjs briefs/sample-airbus.json
node scripts/render-video.mjs outputs/latest
```

Les fichiers generes arrivent dans `outputs/<date>-<sujet>-<mode>/`.

## Creer une video pour un nouveau sujet

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

- `briefs/sample-airbus.json`: sujet d'entree.
- `config/factory.json`: reglages video, style et donnees.
- `templates/preview.html`: rendu vertical anime.
- `scripts/generate.mjs`: fabrique brief, donnees, scenes, caption et payload.
- `scripts/new-brief.mjs`: cree un brief depuis un sujet donne.
- `scripts/pipeline.mjs`: lance generation, rendu et preparation publication.
- `scripts/render-video.mjs`: rend une video WebM et une image de couverture via navigateur.
- `scripts/publish-tiktok.mjs`: connecteur TikTok officiel a finaliser avec token, URL video et app auditee.

## Sorties generees

- `preview.html`: apercu anime ouvrable dans un navigateur.
- `cover.png`: image de couverture.
- `video.webm`: rendu video local.
- `caption.txt`: description + hashtags.
- `publish-payload.json`: payload TikTok.
- `market.json`: donnees normalisees.
- `scenes.json`: timeline video complete.

## Publication TikTok

La publication directe publique demande une app TikTok Developer correctement configuree et auditee.

Configure d'abord `.env` a partir de `.env.example`, puis connecte ton compte:

```powershell
node scripts/tiktok-connect.mjs
```

Verifie ensuite que TikTok reconnait le compte autorise:

```powershell
node scripts/tiktok-status.mjs
```

Pour envoyer la derniere video generee:

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

## Prochaine etape technique

Ajouter un encodeur H.264/MP4 avec `ffmpeg`, puis convertir automatiquement `video.webm` ou les frames vers `video.mp4` avant publication.
