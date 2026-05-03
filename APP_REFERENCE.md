# Sidekix — App reference

Concise overview of **Sidekix** (`sidekix` · Expo SDK ~54) so you can navigate the codebase and product behavior quickly.

---

## Product snapshot

Sidekix is a **social “sidequest” app**: users browse **ideas** (modern **sidequests** plus legacy **challenges**), save them, post **adventures** (submissions with optional photo/video and text), and maintain a lightweight **personal scratch pad** on Home. Profiles, weekly/social mechanics, and notifications extend the core loop.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | **Expo** (RN), **expo-router** (file-based routes) |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions where configured) |
| Fonts | DM Sans / DM Mono / Instrument Serif / Syne (`src/theme.ts`, `app/_layout.tsx`) |
| Images/video | expo-image, expo-av |
| Updates | EAS Update (`eas update` scripts in `package.json`) |

---

## Repo layout

```
app/                 # Screens & routing (Expo Router)
src/
  components/        # Shared UI (Wordmark, PostMediaTile, modals, etc.)
  context/           # Auth + theme
  hooks/             # Data & feature hooks (saved items, feed, posts, scratchpad…)
  lib/               # Supabase helpers, uploads, merge logic, formatting
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
| **Home** | `home.tsx` | ON DECK (first saved / scratch hint / empty state), horizontal **Also saved** (open adventure + unsave), **scratch pad** (Want to try / Done & remembered) via `usePersonalScratchpad`. |
| **Feed** | `feed.tsx` | Mixed feed: sidequests + legacy ideas, saves, **try this →** → `new-adventure` with `sidequestId` or `challengeId`. |
| **Post** | `post.tsx` | Entry to posting flow (routes into modals / upload). |
| **You** | `you.tsx` | Profile, stats row, impact card, journal, settings (theme, sign out, delete account). |

> There is no separate “Activity” tab in the current tab layout; activity-style content may appear inside Feed or elsewhere.

---

## Important stack screens (non-tabs)

| Route | File | Notes |
|-------|------|--------|
| `/new-adventure` | `new-adventure.tsx` | Post an adventure: optional media, caption, search/pick **sidequest or legacy challenge**, anonymous toggle. Params: `sidequestId`, `challengeId` preselect. |
| `/new-sidequest` | `new-sidequest.tsx` | Submit a new sidequest idea. |
| `/upload` | `upload.tsx` | Media upload / text-style picker for challenge posts. Modal. |
| `/sidequest/[id]` | `sidequest/[id].tsx` | Sidequest detail + submissions: **text-only** rows use full-width `SidequestTextSubmissionCard`; media stays in grid. |
| `/challenge/[id]` | `challenge/[id].tsx` | Legacy challenge detail + submission grid/list. |
| `/submission/[id]` | `submission/[id].tsx` | Single submission view. |
| `/saved-quests` | `saved-quests.tsx` | Saved list surface (if used in product). |
| `/today`, `/lead` | `today.tsx`, `lead.tsx` | Weekly / today experiences. |
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

Additional tables (follows, votes, notifications, etc.) are enforced in `supabase/migrations/` and consumed in hooks as needed.

---

## Hooks you’ll touch often

| Hook | File | Purpose |
|------|------|---------|
| `useSavedSidequests` | `src/hooks/useSavedSidequests.ts` | Lists saved sidequests/challenges, toggles save, dedupes concurrent toggles, treats unique violations as success + refresh. |
| `usePersonalScratchpad` | `src/hooks/usePersonalScratchpad.ts` | AsyncStorage-backed “Want to try” / “Done & remembered” lines for Home. |
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
- **`feedCategoryChipParts` / `feedV3TagSkin`** — Category chips on feed/detail.

---

## Media & uploads

- **`uploadPostMediaFromUri`** (`src/lib/uploadPostMedia.ts`) — Uploads to Supabase Storage (paths on post rows).
- **Video** — `prepareVideoForUpload` before upload.
- **Readable URLs** — `useReadableStorageUrl` for private buckets when applicable.

---

## Notifications (outline)

Configured in **`src/lib/notifications*.ts`** and wired in **`app/_layout.tsx`**: init handler, sidequest handlers, Expo push registration, optional friend-request realtime.

---

## Config & tooling

- **Supabase**: `src/lib/supabaseConfig.ts`, `tryGetSupabase()` / `getSupabase()` in `supabase.ts`.
- **CLI scripts**: See `package.json` — `eas:build:*`, `eas:update:*`, Supabase function deploy stubs, broadcast script.

---

## Conventions worth remembering

- **Routing**: Prefer `href` / `router.push` with expo-router paths; adventure entry often uses **`/new-adventure`** + **`params: { sidequestId }`** or **`{ challengeId }`**.
- **Saves**: Sidequest vs legacy use different tables and IDs; hooks expose **both** merged where needed for Home ordering.
- **Text submissions**: Detail screens may use **`SidequestTextSubmissionCard`** vs **`PostMediaTile`** compact/full depending on grid vs full-bleed.

---

## Keeping this doc fresh

After major navigational or data changes, skim **`app/`** route files and **`src/hooks/use*.ts`**; update **Bottom tabs**, **stack screens**, and **hooks** tables above.
