# TikTok review resubmission checklist

## Requested products and scopes

Select only these products and scopes in TikTok for Developers:

- Login Kit: `user.info.basic` (added by Login Kit)
- Content Posting API — Direct Post: `video.publish`

Do not select `video.upload`, `video.list`, or `user.info.stats` unless they are implemented again and demonstrated in a future review video. Update the local `.env` to the same exact value:

```text
TIKTOK_SCOPES=user.info.basic,video.publish
TIKTOK_POST_MODE=direct
```

## Website fields in the portal

- Website URL: `https://getwod5.github.io/BourseIO/`
- Privacy Policy: `https://getwod5.github.io/BourseIO/privacy.html`
- Terms of Service: `https://getwod5.github.io/BourseIO/terms.html`
- Redirect URI: `https://getwod5.github.io/BourseIO/tiktok-callback.html`

The public website must be deployed before resubmission. It is a product page, not a login or landing-only page, and links to the legal pages. The Bourse.IO Studio icon is present in the browser tab and at the top of each legal page. Upload [`app-icon-512.png`](app-icon-512.png) in the TikTok app's **App icon** field.

## Video to attach to the application

Record one continuous 2–3 minute screen capture using a TikTok sandbox account. Do not show any client secret or access token. Generate a new video after this update; older files in `outputs/` may contain the former Bourse.IO overlay and must not be used for the review or posting.

1. Open the public website and show its Privacy Policy and Terms links.
2. Run `npm run dashboard` and open the studio.
3. Click **Connecter TikTok**, show TikTok authorization for `user.info.basic` and `video.publish`, and return to the studio.
4. Create or open a ready video. Click **Préparer l’export TikTok**.
5. Show the video preview and the TikTok account nickname returned by `creator_info/query`.
6. Show that privacy starts with “Choisissez une visibilité”, then select an available option. Show that unavailable Comment/Duet/Stitch options are disabled when TikTok returns them as disabled.
7. Edit the description, show the commercial-content disclosure controls and the TikTok music-usage consent text.
8. Tick the explicit-consent checkbox and click **Publier sur TikTok**. Show the processing notice and use **Actualiser le statut TikTok**.

In the portal’s Apply Reason, state: “Bourse.IO Studio enables independent creators to create and manually publish original educational market videos to their own TikTok accounts. It uses Login Kit and the Content Posting API Direct Post flow. The creator always sees a preview, edits the caption, selects TikTok-provided privacy and interaction settings, makes any required commercial-content disclosure, and explicitly confirms each upload. No automatic publishing is performed.”
