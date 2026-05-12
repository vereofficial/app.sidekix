# Sidekix — App reference

Overview of **Sidekix** (Expo / React Native, Expo SDK ~54) for **engineering** and **website / marketing** context: what the app does, where it lives in the repo, and how major flows behave **today** (see app version in `app.json` / `package.json`).

---

## Product snapshot

Sidekix is a **social “sidequest” app**: people discover **ideas**—modern **sidequests** (community-submitted, approval workflow) and legacy **challenges**—**save** them, then **post adventures** (photo, video, or text card + caption) tied to a specific idea. **Home** prioritizes what’s **on deck** (first saved item) and a **private scratch pad** (only for signed-in users; stored on device per account). **You** shows profile, **two headline stats** (challenges vs ideas), and an **impact** line (including a friendly empty state when no one has completed your credited ideas yet). **Feed** mixes ideas, saves, and prompts to **try this** (opens the post-adventure flow).

Push **notifications** complement the loop: for example when a creator’s **sidequest is approved**, and **local reminders** nudging people back into the app mid-week (engagement). Detail screens emphasize the **idea**, **categories**, and **community posts**—not fake engagement metrics.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | **Expo** (RN), **expo-router** (file-based routes) |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions where configured) |
| Fonts | DM Sans / DM Mono / Instrument Serif / Syne (`src/theme.ts`, `app/_layout.tsx`) |
| Images/video | expo-image, **expo-av** (with a **fallback** when the native video view is unavailable—see `src/lib/videoSupport.ts`) |
| Updates | EAS Update (`eas update` scripts in `package.json`) |

---

## Repo layout

```
app/                 # Screens & routing (Expo Router)
src/
  components/        # Shared UI (Wordmark, PostMediaTile, PostMediaViewerModal, …)
  context/           # Auth + theme
  hooks/             # Data & feature hooks (saved items, feed, posts, scratchpad…)
  lib/               # Supabase helpers, uploads, merge logic, formatting, notifications
  types/             # Shared TS types (`database.ts`, viewer types)
  constants/         # Small static config
  storage/           # Local preferences (e.g. theme)
supabase/            # Migrations & SQL
```

---

## Entry & auth flow

| Path | Role |
|------|------|
| `app/index.tsx` | If Supabase missing → `MissingConfigScreen`. If loading → spinner. If **no session** → `/auth`. If session & onboarding incomplete → `/onboarding`. Else → `/(tabs)/home`. |
| `app/auth.tsx` | Sign-in / sign-up. |
| `app/onboarding.tsx` | First-run onboarding stored per user (`src/lib/onboardingStorage.ts`). |

Root UI: `app/_layout.tsx` — fonts, `SafeAreaProvider`, `AppThemeProvider`, `AuthProvider`, `Stack` navigator, push setup, store rating modal, `WeeklyWinCelebrationHost`.

---

## Bottom tabs (`app/(tabs)/_layout.tsx`)

| Tab | File | Purpose |
|-----|------|---------|
| **Home** | `home.tsx` | **ON DECK** (first saved item, or empty / scratch hint). Horizontal **Also saved** (open adventure + unsave). **Scratch pad** (*Want to try* / *Done & remembered*) via `usePersonalScratchpad`—**only when signed in**; data is **device-local**, **scoped per user id** (not visible to other accounts or on the web). |
| **Feed** | `feed.tsx` | Mixed feed: sidequests, legacy ideas, saves, **try this →** → `new-adventure` with `sidequestId` or `challengeId`. Row copy uses **category-relative timing** where relevant; **no compact “x ago”** timestamps on cards. Activity-style rows may show **@handle**-style names for seeded/system users. |
| **Post** | `post.tsx` | Entry to posting flow (routes into modals / upload). |
| **You** | `you.tsx` | Profile, **two stat boxes** (challenges completed vs ideas credited, with **IDEA / IDEAS** copy), **impact** summary (including *“No one has done your ideas yet — your first one is next.”* when credited count is zero), journal, settings (theme, sign out, delete account). |

There is no separate **Activity** tab; activity-style content appears inside **Feed** (and related surfaces).

---

## Important stack screens (non-tabs)

| Route | File | Notes |
|-------|------|--------|
| `/new-adventure` | `new-adventure.tsx` | Post an adventure: optional media, caption, search/pick **sidequest or legacy challenge**, anonymous toggle. Params: `sidequestId`, `challengeId` preselect. Respects **video support** guard when recording/playing. |
| `/new-sidequest` | `new-sidequest.tsx` | Submit a new sidequest idea (goes through approval). |
| `/upload` | `upload.tsx` | Media upload / text-style picker for posts. Modal. |
| `/sidequest/[id]` | `sidequest/[id].tsx` | Sidequest detail: **single scrolling page**, **title scales** to ~three lines, category chips, grid of submissions (**text** rows can use full-width cards; media in grid). Shows **Posted ✓** when the current user has a submission here. **Idea rating** appears when the idea has a rating—no filler blurb when absent. **No** per-post remove/delete for the viewer on this screen (moderation elsewhere). |
| `/challenge/[id]` | `challenge/[id].tsx` | Legacy challenge detail: aligned patterns with sidequest detail; default subtitle **“Pick a spot, do the quest, post what happened.”** Submissions in grid/list; **tap opens fullscreen** image/video via **`PostMediaViewerModal`**. **Posted ✓** when the user has a legacy post on this challenge. |
| `/submission/[id]` | `submission/[id].tsx` | Single submission view. |
| `/saved-quests` | `saved-quests.tsx` | Saved list surface (if linked from product). |
| `/today`, `/lead` | `today.tsx`, `lead.tsx` | Weekly / today experiences; **lead** may **redirect** visitors (e.g. web funnel) while the app uses tabs. |
| `/p/[id]` | `p/[id].tsx` | Deep link / public profile or post pattern. |
| `/sharecard`, `/post-choice`, `/leader-week/[userId]` | Various | Sharing, choices, leaderboard adjuncts. |

---

## Data model (TypeScript mirrors)

Primary row types live in `src/types/database.ts`:

- **`profiles`** — `ProfileRow` (username, avatar, `friends_only`, …)
- **`sidequests`** — `SidequestRow` (creator, title, categories, `approval_status`, …)
- **`sidequest_posts`** — `SidequestPostRow` (body, image/video paths, anonymity)
- **`sidequest_saves`** — user ↔ sidequest bookmarks
- **`challenges`** — `ChallengeRow` (legacy “idea of the day” style)
- **`posts`** — `PostRow` (challenge submissions; `caption`, `text_style` for text-card presets)
- **`challenge_saves`** — user ↔ challenge bookmarks

Additional tables (follows, votes, notifications, etc.) are enforced in `supabase/migrations/` and consumed in hooks as needed. Example: when a sidequest moves **pending → approved**, the backend can enqueue a **push** so the creator gets a **sidequest approved** notice (see migration **`027_sidequest_approved_notify.sql`** and client handling in `src/lib/notifications*.ts`).

---

## Hooks you’ll touch often

| Hook | File | Purpose |
|------|------|--------|
| `useSavedSidequests` | `src/hooks/useSavedSidequests.ts` | Lists saved sidequests/challenges, toggles save, dedupes concurrent toggles, treats unique violations as success + refresh. |
| `usePersonalScratchpad` | `src/hooks/usePersonalScratchpad.ts` | **Per-user** AsyncStorage “Want to try” / “Done & remembered” for Home (keys include **user id**). |
| `useSidequestPosts` | `src/hooks/useSidequestPosts.ts` | Posts + usernames for a sidequest detail. |
| `useLegacyChallengePosts` | `src/hooks/useLegacyChallengePosts.ts` | Challenge submissions. |
| `useAuth` | `src/context/AuthContext.tsx` | Session, profile, sign out, delete account, profile saves. |
| `useAppTheme` | `src/context/AppThemeContext.tsx` | System / light / dark + `getColors(resolvedScheme)`. |

Feed-specific: `useSidequestFeed`, `useFlowingSidequestSubmissions`, `mergeActivityFeed`, etc., under `src/hooks/` and `src/lib/`.

---

## Theme & UI tokens

- **`src/theme.ts`** — `lightColors` / `darkColors` (`accent`, `lightAccent`, surfaces, borders, text steps).
- **`font` object** maps logical names (e.g. `serifItalic`, `mono`, `syne`) to loaded families.
- **`PostMediaTile`** — Renders image / video / **text-only** tiles using `textPostPresets.ts` (gradient presets, default “Moss” at index 0).
- **`PostMediaViewerModal`** — Fullscreen viewer for **images and video** on detail flows (e.g. legacy challenge).
- **`feedCategoryChipParts` / `feedV3TagSkin`** — Category chips on feed/detail.

---

## Media & uploads

- **`uploadPostMediaFromUri`** (`src/lib/uploadPostMedia.ts`) — Uploads to Supabase Storage (paths on post rows).
- **Video** — `prepareVideoForUpload` before upload; UI paths honor **`isVideoPlaybackSupported()`** / **`isVideoRecordingSupported()`** from `src/lib/videoSupport.ts` when `expo-av`’s native view is missing.
- **Readable URLs** — `useReadableStorageUrl` for private buckets when applicable.

---

## Notifications (product-level)

- **Push (server-driven):** Kinds are handled in **`src/lib/notifications.native.ts`** (and related helpers). Example: **`sidequest_approved`** deep-links to the **sidequest detail** so the creator can see their live idea. Enqueueing can be tied to DB transitions (e.g. **`027_sidequest_approved_notify.sql`**).
- **Local scheduling:** **Weekly engagement** reminders (mid-week) are scheduled from the client; **leaderboard / friend-request / Mon–Fri “drop”** style locals are **not** the current focus of the local schedule.
- **Wiring:** Init, permissions, and navigation on notification tap live in **`app/_layout.tsx`** and **`src/lib/notifications*.ts`**. Human-readable copy patterns live in **`src/lib/notificationMessages.ts`**.

---

## Config & tooling

- **Supabase**: `src/lib/supabaseConfig.ts`, `tryGetSupabase()` / `getSupabase()` in `supabase.ts`.
- **CLI scripts**: See `package.json` — `eas:build:*`, `eas:update:*`, Supabase function deploy stubs, broadcast script.

---

## Conventions worth remembering

- **Routing**: Prefer `href` / `router.push` with expo-router paths; adventure entry often uses **`/new-adventure`** + **`params: { sidequestId }`** or **`{ challengeId }`**.
- **Saves**: Sidequest vs legacy use different tables and IDs; hooks expose **both** merged where needed for Home ordering.
- **Text submissions**: Detail screens may use **`SidequestTextSubmissionCard`** vs **`PostMediaTile`** compact/full depending on grid vs full-bleed.
- **Privacy (website copy):** Scratch pad and on-device preferences are **not** synced as a public profile field; saves and posts are **backend** features with normal app privacy rules.

---

## Keeping this doc fresh

After major navigational or data changes, skim **`app/`** route files and **`src/hooks/use*.ts`**; update **Bottom tabs**, **stack screens**, **notifications**, and **hooks** sections above—especially anything mirrored on **sidekix.com** or partner pages.
