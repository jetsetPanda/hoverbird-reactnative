# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A React Native (Expo) app for nanny ↔ parent activity logging. Nannies log
activities/milestones for the children they care for; parents see a live feed.
Full product spec, data model rationale, and decision log live in
**`docs/architecture.md`** — read it before implementing any feature, since it
captures decisions (invitation flow, one-child-per-activity, deferred photos,
etc.) that aren't obvious from code alone.

**Current state:** the MVP is shipped and connected to Supabase
(`@supabase/supabase-js`): auth/onboarding, 6-digit invitations (plus a
custom-scheme deep link), family/child setup, nanny activity logging
(templates, free-text notes, photos, multi-child), the parent feed, push
notifications, and a responsive web build deployable to EAS Hosting.
`docs/architecture.md` §7 tracks what has shipped vs. what is still open;
`git log` and the open PRs are the live truth.

## Commands

```bash
npm install
npx expo start          # dev server (scan QR / press i / a / w)
npm run android          # start + open Android
npm run ios              # start + open iOS
npm run web              # start + open web
npm run lint              # expo lint (eslint-config-expo flat config)
npm run reset-project    # moves template code to app-example/, blanks app/
```

There is no test runner configured in `package.json`.

## Architecture

- **Routing:** Expo Router (file-based) rooted at `app/`. `app/_layout.tsx` is
  the root `Stack`, anchored on the `(tabs)` group (see `unstable_settings`).
  `app/(tabs)/_layout.tsx` defines the tab bar; `app/modal.tsx` is presented
  modally from the root stack.
- **Aliasing:** `@/*` maps to the repo root (`tsconfig.json`), e.g.
  `@/components/...`, `@/hooks/...`, `@/constants/theme`.
- **Theming:** `constants/theme.ts` exports `Colors`/`Fonts` for light/dark
  mode; `hooks/use-color-scheme.ts` (+ `.web.ts` variant) and
  `hooks/use-theme-color.ts` drive themed components (`themed-text.tsx`,
  `themed-view.tsx`).
- **New Architecture + React Compiler** are both enabled (`app.json`:
  `newArchEnabled`, `experiments.reactCompiler`), as is `typedRoutes`.

## Backend (Supabase) — per docs/architecture.md

- Postgres schema, RLS policies, and helper functions are all defined in
  `supabase/schema.sql` — apply it via the Supabase SQL Editor or as a
  migration; it's the single source of truth for the data model. Post-MVP
  changes (`activity_children`, the `activity-media` bucket) were applied
  directly to the live project and documented here rather than as files under
  `supabase/migrations/`, so `schema.sql` — not the migrations folder —
  reflects the real database.
- Core tables: `profiles` (role: parent|nanny), `families`, `children`,
  `family_members` (M:N parents↔family), `caregiver_assignments` (M:N
  nannies↔family), `invitations` (6-digit code join flow), `activity_templates`
  (seeded tap-to-log presets), `activities` (`child_id` is the primary child;
  the `activity_children` join table carries the full set for multi-sibling
  logging).
- Access control is enforced entirely through RLS using two
  `SECURITY DEFINER` helpers, `has_family_access(family_id)` and
  `is_family_caregiver(family_id)`: parents/nannies linked to a child's family
  can read its activities; only the assigned nanny can write, as themselves.
- `redeem_invite(code)` is `SECURITY DEFINER` specifically because a code
  redeemer has no family access yet — RLS alone can't allow that insert.
- `media_urls` on `activities` holds Supabase Storage paths for attached
  photos (private `activity-media` bucket, rendered via short-lived signed
  URLs — see `lib/media.ts`).
