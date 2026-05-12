# Supabase Edge Functions

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

---

### Expo / EAS: wiring the public read URL (step-by-step)

The app does **not** use Supabase signed URLs for `r2/…` paths. It builds a normal HTTPS URL:

`{EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL}` + `/` + URL-encoded object key **without** the `r2/` prefix.

Example: DB has `r2/abc123/photo.jpg` → browser loads  
`https://pub-xxxxx.r2.dev/abc123/photo.jpg` (exact host depends on your bucket’s public URL).

If `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` is missing or wrong in the **built binary**, images/videos **never** get a URI and will **load forever** (spinner). Uploads can still work via `r2-media-presign` because that uses a different (S3 API) URL.

#### 1. Cloudflare: enable a **public read** origin (not the S3 API host)

| URL kind | Typical shape | Used for |
|----------|----------------|----------|
| **S3 API (private writes)** | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | Presigned **PUT** from the Edge Function only. **Do not** set this as `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`. Browsers are not meant to GET arbitrary objects from here with your app config. |
| **Public read (what you need)** | `https://pub-xxxxxxxx.r2.dev` (R2 “Public bucket URL”) or `https://media.yourdomain.com` (custom domain) | **GET** for `Image` / `Video` in the app. |

**In the Cloudflare dashboard**

1. Log in → **R2** → open your **bucket** (same name as `R2_BUCKET_NAME` in Supabase Edge secrets).
2. Open **Settings** (bucket settings, not only the object list).
3. Under **Public access** (wording varies):
   - Enable **R2.dev subdomain** / **Public Development URL** / “Allow access” for the public hostname Cloudflare shows, **or**
   - Connect a **Custom Domain** and wait until DNS/status is **Active**.
4. Copy the **public** base URL Cloudflare shows for that feature — usually `https://pub-xxxxx.r2.dev` or your custom `https://media.…`.

Sanity checks:

- The value must be **`https://`** (TLS). No trailing slash: use `https://pub-xxxxx.r2.dev`, not `https://pub-xxxxx.r2.dev/`.
- It must **not** end with `/r2` or include the `r2/` prefix; the app adds the key after the base.

#### 2. Local development (Metro / Expo Go / dev client)

1. In the project root, copy `.env.example` → `.env` if you don’t have one yet.
2. Set (real values from Cloudflare):

   ```bash
   EXPO_PUBLIC_USE_R2_MEDIA=1
   EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL=https://pub-YOUR_SUBDOMAIN.r2.dev
   ```

3. `app.config.js` loads `.env` via `dotenv` and copies these into **`expo.extra`** (`r2PublicMediaUrl`, `useR2Media`) so they match what `src/lib/r2MediaConfig.ts` reads at runtime.
4. **Restart Metro** after changing any `EXPO_PUBLIC_*` variable (`npx expo start` — stop and start again; use `npm run start:clear` if the old bundle is sticky).
5. Quick verification in a desktop browser (replace with your base + a real key from the DB, without the `r2/` prefix):

   `https://pub-xxxxx.r2.dev/<userId>/<filename>.jpg`  
   You should get **200** and the image bytes, not 403/404.

#### 3. EAS / TestFlight / Play Store builds (why “it works in dev but not in TestFlight”)

`EXPO_PUBLIC_*` values are **embedded when the native app is built**, not read from your laptop at install time.

Do **all** of the following that apply:

**Option A — Expo website (recommended for teams)**

1. [expo.dev](https://expo.dev) → your **Sidekix** project → **Environment variables** (or **Secrets** depending on Expo UI version).
2. Add **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** with the same public base URL as local (no trailing slash).
3. Add **`EXPO_PUBLIC_USE_R2_MEDIA`** = `1` if you use R2 uploads in production.
4. Attach these variables to the **environment** your EAS profiles use (e.g. **production**, **preview**). If a profile doesn’t inherit them, the store build will have **no** URL → infinite loading for all `r2/…` media.

**Option B — EAS Secrets / `eas.json`**

- You can also define the same keys for the build worker environment so `app.config.js` sees them when EAS runs `npx expo prebuild` / export. Names must still be **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** (or `R2_PUBLIC_MEDIA_URL` is read in `app.config.js` only and mapped into `extra.r2PublicMediaUrl` — see repo `app.config.js`).

**Then: create a new build**

- Run a **new** `eas build` (or your `npm run eas:build:*` script) after saving env vars. **OTA updates alone do not add** `expo.extra` keys that weren’t in the original native manifest unless your workflow explicitly updates them; safest is **rebuild** after first configuring R2 public URL.

#### 4. Verify from the app / logs

- After a misconfiguration, Metro may log once:  
  `[Sidekix media] Database paths use R2 (r2/…) but no public read URL is configured…`  
  (from `src/lib/storageMediaUrl.ts`).
- If URLs are set but **wrong** (404), you’ll usually see broken images or errors, not always “infinite” spinners — fix the base URL or bucket public access.

#### 5. Still confused: two-line checklist

1. **Bucket** has a working **public GET** URL in the browser for `https://<public-base>/<key>`.
2. **That exact `<public-base>`** is in **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** for the **same** build you installed (local `.env` + Metro restart, or Expo env + new EAS build).

#### 6. Custom domain error: *“That domain was not found on your account…”*

R2 **public bucket** custom hostnames (e.g. `media.joinsidekix.com`) must be a domain **this Cloudflare account already controls**, with DNS **managed in Cloudflare** for that hostname. If `joinsidekix.com` only exists on **Namecheap** (or Vercel DNS) and you have **not** added that zone to Cloudflare, Cloudflare has nothing to attach — you get exactly that error.

**What to do right now (works without moving DNS):** copy the bucket **Public Development URL** from the dashboard (*Settings → Public Development URL* — it looks like `https://pub-xxxxxxxx.r2.dev`). Set **`EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL`** to that value (no trailing slash), rebuild the app. Media should load. Cloudflare’s note about rate limits / no WAF means it’s fine for development and many early apps; switch to a custom hostname when you’re ready for production hardening.

**If you want `media.joinsidekix.com` later:** add **`joinsidekix.com`** (or at least a delegated subdomain) as a **zone in this Cloudflare account** and point nameservers or NS delegation so Cloudflare can publish the DNS records R2 needs — *or* keep using `pub-*.r2.dev` until you migrate DNS. You do **not** need a custom domain for the app to resolve URLs; you only need **some** valid public HTTPS base.

### DNS on Namecheap / Vercel — you don’t move “everything” to Cloudflare

- **Media (R2)** and **your app domains** are separate.
- **Easiest**: In the R2 bucket, enable Cloudflare’s **public `r2.dev` URL** (or `pub-*.r2.dev`). Set `EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL` to that hostname. **No changes** to Namecheap or Vercel DNS.
- **Custom media hostname on your zone** (e.g. `media.yourbrand.com`): In the R2 / Cloudflare UI, Cloudflare gives you DNS records (often a **CNAME**). Add those in **Namecheap → Domain List → your domain → Advanced DNS**. You stay on Namecheap for DNS and keep **Vercel** for whatever hostnames already point there (apex `www`, etc.).
- Cloudflare accounts use **their** nameservers **only when** Cloudflare manages that hostname’s DNS for you. If you prefer not to migrate DNS, rely on **`r2.dev`** for reads or paste only the CNAME/target records Cloudflare shows for “Connect domain” (if offered for external DNS).

If R2 is not configured, leave `EXPO_PUBLIC_USE_R2_MEDIA` unset; the app keeps using Supabase Storage with `Uint8Array` uploads.
