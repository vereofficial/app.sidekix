b # Supabase Edge Functions

| Function                      | Path                                   | Purpose |
|-------------------------------|----------------------------------------|--------|
| `delete-account`              | `delete-account/index.ts`              | Deletes the signed-in user via Auth Admin API (`POST`/`DELETE` with `Authorization: Bearer <access_token>`). |
| `r2-media-presign`            | `r2-media-presign/index.ts`            | Returns a presigned **PUT** URL for Cloudflare R2 (S3 API). Client uploads bytes directly to R2, then stores `r2/<key>` in Postgres. |
| `broadcast-expo-push`         | `broadcast-expo-push/index.ts`          | Broadcast one message to **all** registered Expo tokens (`BROADCAST_PUSH_SECRET`). |
| `deliver-notification-outbox` | `deliver-notification-outbox/index.ts` | Drains `notification_outbox` with per-user Expo pushes; rows include `title`, `body`, and `data` for deep links (`DELIVER_OUTBOX_SECRET`). **Schedule** (e.g. every minute) with `pg_cron` or an external ping. |
| `enqueue-scheduled-notifications` | `enqueue-scheduled-notifications/index.ts` | Enqueues trending + gentle / saved-list re-engagement (`SCHEDULED_NOTIFS_SECRET`). Run **daily or hourly** before `deliver-notification-outbox`. Requires migration `025_scheduled_reengagement_trending_peek.sql`. |

Deploy (CLI):

```bash
supabase functions deploy delete-account --project-ref YOUR_PROJECT_REF
supabase functions deploy r2-media-presign --project-ref YOUR_PROJECT_REF
supabase functions deploy deliver-notification-outbox --project-ref YOUR_PROJECT_REF
supabase functions deploy enqueue-scheduled-notifications --project-ref YOUR_PROJECT_REF
```

`enqueue-scheduled-notifications` secrets: `SCHEDULED_NOTIFS_SECRET`. Trends: ≥3 completions on a sidequest in 48h. Gentle re-engagement: no post in 14d. Saved nudge: ≥1 saved sidequest and no post in 7d. Respects `notification_preferences.social !== false`.

`deliver-notification-outbox` secrets: `DELIVER_OUTBOX_SECRET` (required), plus default `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

### `r2-media-presign` secrets (Dashboard → Edge Functions → Secrets)

Set these for R2:

- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 API token access key
- `R2_SECRET_ACCESS_KEY` — R2 API token secret
- `R2_BUCKET_NAME` — bucket name

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically.

### Two different URLs (this is the confusing part)

| Role | What it is | Where it lives |
|------|------------|----------------|
| **Upload (writes)** | S3-compatible API host: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | Built **inside** the Edge Function from `R2_ACCOUNT_ID`. **Never** put this in Expo `.env`. Your **four Supabase secrets** are only for signing uploads. |
| **Display (reads)** | A **public HTTPS base** where anyone can **GET** a file without a secret (e.g. `https://pub-xxxxx.r2.dev` or `https://media.yourbrand.com`) | **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** in the app (no trailing slash). The app joins this + object path to show images/video. |

The hostname you see under **bucket → Settings → S3 API** is for **writes / API tools**, not for “paste this into EXPO_PUBLIC” unless you’ve also exposed **anonymous read** — which the raw S3 API URL does **not** do by default.

### Bucket: turn on something the app can **read**

In R2 → your bucket (**e.g. `sidekix-media`**) → **Settings**:

1. Either enable **Public Development URL** (`r2.dev` / “public bucket URL”), **or**
2. Attach a **Custom domain** and use that hostname.

If **Public Development URL is disabled** and there is **no custom domain**, there is **no** valid value for `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` yet — uploads might work but the app **won’t** be able to load media.

Then set **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** exactly to Cloudflare’s **public read** origin (whatever the dashboard shows for that feature), **not** `…cloudflarestorage.com`.

### App / web env (Expo — **no R2 secrets here**)

- `EXPO_PUBLIC_USE_R2_MEDIA=1` — use R2 upload flow + `r2/…` paths in the DB  
- `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` — **only** the public read base URL from the step above (no trailing slash)

Vercel share HTML (`api/share-html.ts`) can use `R2_PUBLIC_MEDIA_URL` as a fallback if `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` is not set at build time.

### DNS on Namecheap / Vercel — you don’t move “everything” to Cloudflare

- **Media (R2)** and **your app domains** are separate.
- **Easiest**: In the R2 bucket, enable Cloudflare’s **public `r2.dev` URL** (or `pub-*.r2.dev`). Set `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` to that hostname. **No changes** to Namecheap or Vercel DNS.
- **Custom media hostname on your zone** (e.g. `media.yourbrand.com`): In the R2 / Cloudflare UI, Cloudflare gives you DNS records (often a **CNAME**). Add those in **Namecheap → Domain List → your domain → Advanced DNS**. You stay on Namecheap for DNS and keep **Vercel** for whatever hostnames already point there (apex `www`, etc.).
- Cloudflare accounts use **their** nameservers **only when** Cloudflare manages that hostname’s DNS for you. If you prefer not to migrate DNS, rely on **`r2.dev`** for reads or paste only the CNAME/target records Cloudflare shows for “Connect domain” (if offered for external DNS).

If R2 is not configured, leave `EXPO_PUBLIC_USE_R2_MEDIA` unset; the app keeps using Supabase Storage with `Uint8Array` uploads.
