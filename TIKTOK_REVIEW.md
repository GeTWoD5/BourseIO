# TikTok App Review — Bourse_IO Studio

## Products and scopes

- Login Kit: `user.info.basic` for the connected creator identity.
- Dashboard metrics: `user.info.stats` and `video.list` for the existing statistics panel (followers, engagement and recent videos).
- Content Posting API — Direct Post: `video.publish` for a creator-confirmed direct post.
- Content Posting API — Upload: `video.upload` for a creator-confirmed TikTok Inbox Draft.

Use this same exact scope value in the VM `.env`:

```text
TIKTOK_SCOPES=user.info.basic,user.info.stats,video.list,video.publish,video.upload
```

The production calendar may generate videos automatically, but it never sends content to TikTok. Every TikTok transfer is opened manually by the creator, requires explicit consent, and offers either Direct Post or a TikTok Inbox Draft.

## Apply Reason

`Bourse_IO Studio lets creators generate original educational market videos, review quality checks and manage their TikTok performance metrics. The creator connects their own TikTok account, views followers and recent-video metrics, then manually chooses either Direct Post or a TikTok Inbox Draft. Direct Post shows the account, editable caption, TikTok-provided visibility and interaction settings, commercial-content disclosure controls and explicit consent. A draft is transferred only after explicit consent and is edited and published by the creator in TikTok. No content is published automatically.`

## Demo video

Record one continuous sandbox capture. Do not reveal a Client Secret, OAuth code or access token.

1. Show the public Bourse_IO page, its icon, Privacy Policy and Terms links.
2. Open the Bourse_IO Studio dashboard on the VM.
3. Connect a sandbox account and show the authorization for all five scopes.
4. Show the dashboard statistics panel and refresh the followers/recent-video metrics.
5. Produce or open a quality-validated video, then approve it for manual export.
6. Select **Préparer l'export TikTok**. Show the creator account, preview, caption and direct-post privacy/interactions controls.
7. Give explicit consent and make a private Direct Post. Show the processing status.
8. Open a second validated video, select **Envoyer comme brouillon TikTok**, give consent, send it, then show the TikTok inbox notification used to finish editing and publishing.
