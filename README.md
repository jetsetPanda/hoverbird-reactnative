# HoverBird

A React Native (Expo) mobile app for **nanny ↔ parent activity logging**.
Nannies log the activities and milestones they do with the children in their
care; parents follow along in a live feed and get a push notification on every
new entry.

The full product spec, data-model rationale, and decision log live in
[`docs/architecture.md`](docs/architecture.md) — read it before implementing a
feature, since it records intentional choices (invitation flow,
one-child-per-activity origin, deferred features) that aren't obvious from the
code alone. The database is the single source of truth for the data model and
lives in [`supabase/schema.sql`](supabase/schema.sql).

---

## Tech stack

| Layer | Choice | Version |
|---|---|---|
| Mobile framework | Expo (managed workflow) | SDK 54 |
| | React Native | 0.81 |
| | React | 19 |
| Routing | Expo Router (file-based) | 6 |
| Server state | TanStack Query (React Query) | 5 |
| Backend / BaaS | Supabase — Postgres, Auth, Storage, Realtime | `@supabase/supabase-js` 2 |
| Push notifications | Expo Notifications + a Supabase Edge Function | — |
| Language | TypeScript | 5.9 |
| Lint | ESLint (`eslint-config-expo` flat config) | 9 |

**New Architecture** and the **React Compiler** are both enabled
(`app.config.js`: `newArchEnabled`, `experiments.reactCompiler`), along with
typed routes. Avoid patterns that break compiler assumptions (e.g. mutating
values during render).

Notable native modules: `expo-notifications`, `expo-image` /
`expo-image-picker`, `expo-haptics`. Because these ship native code, the app
runs on a **development build**, not Expo Go (see
[Running the app](#running-the-app)).

---

## Features

- **Auth + onboarding** — email/password sign-up, then pick a role
  (parent or nanny).
- **Invitations** — either side generates a 6-digit code; the other enters it
  to form the parent↔nanny↔family relationship.
- **Family / child setup** — parents create the family and add/edit children.
- **Activity logging (nanny)** — a grid of one-tap template buttons plus a
  free-text note, an optional photo, and a multi-child selector (log one
  activity for several siblings at once).
- **Activity feed (parent)** — reverse-chronological, live-updating timeline,
  filterable by category, with photo thumbnails.
- **Push notifications** — a Postgres webhook on new `activities` rows invokes
  an Edge Function that sends an Expo push to the family's parents.

---

## Project structure

```
app/                       Expo Router routes (file-based)
  _layout.tsx              Root stack; auth-guarded route groups
  (auth)/                  sign-in, sign-up (unauthenticated)
  complete-profile.tsx     Role + name, shown after first sign-up
  (tabs)/                  Main tab bar
    index.tsx              Activity — nanny logs / parent feed (role-switched)
    family.tsx             Family, children, and invitations
    info.tsx               Account
  modal.tsx                Modal presented from the root stack
components/                Themed + shared UI (themed-text, themed-view, ui/)
constants/theme.ts         Colors, Fonts, Spacing, Radii, category styles
contexts/auth-provider.tsx Session + profile context
hooks/                     use-color-scheme, use-theme-color
lib/                       Data layer (Supabase queries, one file per domain)
  supabase.ts              Supabase client
  activities.ts  families.ts  invitations.ts  media.ts  notifications.ts
supabase/
  schema.sql               Data model, RLS policies, helper functions (SoT)
  migrations/              Incremental SQL migrations
  functions/               Edge Functions (send-activity-push)
```

The `@/*` path alias maps to the repo root (see `tsconfig.json`), e.g.
`@/components/...`, `@/lib/...`, `@/constants/theme`.

---

## Prerequisites

- **Node.js** 20+ and npm (required by Expo SDK 54)
- A **Supabase** project (for the backend — see [Backend setup](#backend-setup))
- For device/emulator builds: an **[Expo / EAS account](https://expo.dev)**
  and the EAS CLI (`npx eas-cli`)
- Android builds also need Firebase Cloud Messaging credentials
  (`google-services.json`) for push — see [Environment](#environment)

---

## Environment

Two machine-local files are **gitignored** and must be present to run the app.
They are per-machine and are not committed:

- **`.env.local`** (repo root) — Supabase connection, read via
  `EXPO_PUBLIC_*` env vars:

  ```bash
  EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  ```

  The app throws on startup without these (see `lib/supabase.ts`).

- **`google-services.json`** (repo root) — Firebase/FCM credentials for Android
  push. On EAS Build it is supplied via the `GOOGLE_SERVICES_JSON` file env var;
  locally it falls back to this file (see `app.config.js`).

---

## Install

```bash
npm install
```

---

## Running the app

This app uses native modules, so it needs a **development build** rather than
Expo Go.

Start the dev server (Metro):

```bash
npm start          # expo start
```

Open it on a target:

```bash
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run web        # expo start --web  (most UI works; native push/camera do not)
```

If you don't yet have a development build installed on your device/emulator,
create one with EAS (the `development` profile in `eas.json` produces a
dev-client APK/app):

```bash
npx eas-cli build --profile development --platform android
# or --platform ios
```

Install the resulting build, then `npm start` and connect to it. Reloading
JavaScript is enough for most changes — **but adding or changing a native
module (a new `expo-*` package with native code) requires a new development
build**, not just a Metro reload.

### Build profiles (`eas.json`)

| Profile | Purpose |
|---|---|
| `development` | Dev client (internal distribution, Android APK) |
| `preview` | Internal test build (Android APK) |
| `production` | Store build (auto-incrementing version) |

---

## Backend setup

Backend setup is documented in full in
[`docs/architecture.md`](docs/architecture.md) §8. In short:

1. Apply [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL
   Editor (tables, RLS policies, helper functions, seed data), then any files
   in `supabase/migrations/`.
2. Enable **Email** auth (Authentication → Providers).
3. Run `npx eas-cli init` so `app.config.js` has an `extra.eas.projectId` —
   client push registration in `lib/notifications.ts` no-ops without it.
4. Deploy the push function: `npx supabase functions deploy send-activity-push`.
5. Create a Database Webhook on `activities` INSERT that calls
   `send-activity-push`.

**Access control lives entirely in the database (RLS)**, built on the
`SECURITY DEFINER` helpers `has_family_access(family_id)` and
`is_family_caregiver(family_id)`: parents and nannies linked to a child's
family can read its activities; only the assigned nanny can write, as
themselves. `redeem_invite(code)` is `SECURITY DEFINER` because a code redeemer
has no family access yet. Never bypass RLS with a service-role key in app code.

---

## Linting

```bash
npm run lint       # expo lint
```

There is no test runner configured.

---

## Conventions

- **Theming:** colors and fonts come from `constants/theme.ts` via
  `useThemeColor` and the themed components (`themed-text.tsx`,
  `themed-view.tsx`).
- **Data layer:** one file per domain under `lib/`; screens call these rather
  than hitting Supabase inline.
- **Workflow:** feature branch → PR → merge to `main`. Commits use conventional
  prefixes (`feat:`, `fix:`, `chore:`). Nothing lands directly on `main`.
- **Docs stay in sync:** when behavior, schema, or a recorded decision changes,
  update the relevant doc (`docs/architecture.md`, schema comments) in the same
  change.

See [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md) for the guidance given
to AI assistants working in this repo (notably: verify against the versioned
Expo SDK 54 docs before writing framework code).
