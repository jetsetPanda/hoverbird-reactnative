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

**Current state:** the `app/` tree is still the unmodified `create-expo-app`
template (tabs example screens, no auth/Supabase wiring yet). The backend
schema in `supabase/schema.sql` exists and is documented but has not been
applied or connected to the app — there is no `@supabase/supabase-js`
dependency yet. Treat the architecture doc as the target design, not the
current implementation.

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
  migration; it's the single source of truth for the data model.
- Core tables: `profiles` (role: parent|nanny), `families`, `children`,
  `family_members` (M:N parents↔family), `caregiver_assignments` (M:N
  nannies↔family), `invitations` (6-digit code join flow), `activity_templates`
  (seeded tap-to-log presets), `activities` (one `child_id` per row — multi-
  child logging is an intentional post-MVP revisit).
- Access control is enforced entirely through RLS using two
  `SECURITY DEFINER` helpers, `has_family_access(family_id)` and
  `is_family_caregiver(family_id)`: parents/nannies linked to a child's family
  can read its activities; only the assigned nanny can write, as themselves.
- `redeem_invite(code)` is `SECURITY DEFINER` specifically because a code
  redeemer has no family access yet — RLS alone can't allow that insert.
- `media_urls` on `activities` exists now but photo upload UI is deliberately
  deferred — no migration will be needed when that ships.
