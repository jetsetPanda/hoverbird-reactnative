# Nanny ↔ Parent Activity App — Architecture & Decisions

> Handoff document. Captures every decision made during planning so any future
> session (or Claude Code inside WebStorm) can read this file and have full context.
> Keep this committed at the repo root or in `docs/`.

---

## 1. What this app is

A React Native mobile app with two user types — **parents** and **nannies**.
Nannies log the activities and milestones they do with the children in their care;
parents see those updates in a live feed and get notified. The MVP's job is to make
**activity/milestone logging** excellent; everything else is secondary.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | **React Native via Expo** (managed workflow) | One build pipeline (EAS) for iOS + Android; built-in push, image picker, OTA updates; no Xcode/Android Studio for most work. Fastest path to shipping on both platforms. |
| Backend / BaaS | **Supabase** | Managed Postgres + auth + storage + realtime + row-level security. Data is inherently relational (nannies ↔ families ↔ children), which Postgres models far better than Firestore. No servers to run. |
| Push notifications | **Expo Notifications** + Supabase Edge Function / DB webhook | Trigger a send when a new activity row is inserted. |
| Server state | **TanStack Query (React Query)** + Supabase client | Lightweight; no Redux needed for an MVP. |
| File storage | **Supabase Storage** | Activity photos: private `activity-media` bucket, accessed via signed URLs. |

**Platforms:** iOS + Android (no web for MVP).
**Backend philosophy:** whatever ships fastest → managed BaaS, no custom servers.

---

## 3. Data model

Full SQL (tables, constraints, indexes, RLS policies, helper functions, seed data)
lives in **`schema.sql`**. High-level shape:

- **profiles** — extends `auth.users` 1:1. Holds `role` (parent | nanny), name, avatar.
- **families** — a household unit.
- **children** — belong to exactly one family. `birthdate` will power age-based
  milestone suggestions later.
- **family_members** — M:N join of parents/guardians ↔ family. Supports multiple
  parents sharing one family.
- **caregiver_assignments** — M:N join of nanny ↔ family. This is what makes
  *one nanny ↔ many families* and *many nannies ↔ one family* both work.
- **invitations** — 6-digit code flow (see §5). Either side can invite.
- **activity_templates** — seeded tap-to-log presets (e.g. "Ate lunch", "Took a nap",
  "First steps!"). 14 seeded, including a `custom` catch-all.
- **activities** — the core table. `child_id` holds the **primary** child; the
  `activity_children` join table (added post-launch) carries the full set for
  multi-sibling logging. The `media_urls` array holds Supabase Storage paths for
  attached photos (private `activity-media` bucket).

### Security model (enforced via RLS)
- Parents **and** nannies linked to a child's family can **read** that child's activities.
- Only an **assigned nanny** can **write** activities, and only as themselves.
- Two `SECURITY DEFINER` helpers (`has_family_access`, `is_family_caregiver`) carry
  this rule across all policies.
- **`redeem_invite(code)`** is a `SECURITY DEFINER` function — critical because a
  person redeeming a code has no family access yet, so plain RLS would block them.
  The function validates the code and creates the correct join row.

---

## 4. MVP feature set

1. **Auth + onboarding** — sign up, pick role (parent / nanny).
2. **Invitations** — either side generates a 6-digit code; the other enters it to
   form the relationship.
3. **Family/child setup** — parents create the family and add children.
4. **Activity logging (nanny)** — the most important screen. A grid of template
   buttons for one-tap logging, plus a free-text option and an optional photo,
   with timestamp and child selector. Logs against one **or more** children at
   once (multi-select; shipped post-launch — see §7).
5. **Activity feed (parent)** — reverse-chronological timeline per child, filterable
   by category.
6. **Notifications** — push on new activity **and** the in-app feed as the persistent
   record.

### Logging method
**Both** template tap-to-log **and** free-text notes are supported (templates write a
`template_key`; free-text leaves it null and uses the `custom` template + `note`).

### Deliberately out of scope for MVP
Messaging/chat · daily auto-summaries · multi-language · web app.
(Photo attachments and multi-sibling logging were out of scope for the MVP but
have since shipped — see §7.)

---

## 5. Key decisions log

| Decision | Choice | Notes |
|---|---|---|
| Relationship shapes | All of: 1 nanny↔1 family, 1 nanny↔many, many nannies↔1 family | Drives the M:N join tables. |
| How relationships form | **Either side can invite** | Via invitation table. |
| Invitation mechanism | **6-digit code** | Chosen over deep links for MVP — works even before the app is installed, no domain verification, just one input screen. **(Revisit — see §7.)** |
| Logging granularity | ~~One child per activity~~ → **multi-child** | **Shipped** (PR #7): `activity_children` join table lets one activity cover several siblings; `activities.child_id` stays populated as the primary child for compatibility. |
| Photos on activities | ~~Deferred~~ → **shipped** | **Shipped** (PR #6): `expo-image-picker` + a private `activity-media` Storage bucket; `media_urls` stores storage paths, rendered via signed URLs. |
| Invitation delivery | 6-digit code **+ deep link** | **Shipped** (custom scheme): share sheet includes a `hoverbirdreactnative://…?code=` link that prefills the redeem form; the code persists through sign-up so new users land on it. Universal/App links still pending (see §7). |
| Parent notification | **Push + in-app feed** | Both. |

---

## 6. Suggested build order

1. Auth + `profiles` creation
2. Apply `schema.sql` (data model + RLS)
3. Family/child setup screens
4. Invitations (generate code + redeem screen → `redeem_invite`)
5. **Logging screen** (the centerpiece)
6. Activity feed
7. Push notifications

> Ship the simplest end-to-end path first — **one nanny logging to one parent** —
> before layering in the many-to-many invitation flows.

---

## 7. 📌 Post-launch revisit list

These were intentionally simplified for the MVP. The schema is forward-compatible
with all of them.

**✅ Shipped since launch:**

- **Multi-sibling logging** — one activity against multiple children at once, via
  the `activity_children` join table (PR #7). `activities.child_id` remains the
  primary child so existing queries, realtime, and the push function keep working.
- **Activity photos** — `media_urls` wired to a private `activity-media` Supabase
  Storage bucket + `expo-image-picker` (PR #6); feed renders thumbnails via
  short-lived signed URLs.
- **Deep-link invitations (custom scheme)** — the invite share sheet includes a
  `hoverbirdreactnative://…?code=NNNNNN` link. `app/_layout.tsx` captures the code
  from the incoming URL (`expo-linking`) into an AsyncStorage-backed pending store
  (`lib/pending-invite.ts`); the redeem form prefills from it and clears it on a
  successful join. The code survives the sign-up → complete-profile flow, so a
  brand-new invitee lands on a prefilled redeem screen.

**Still open:**

- **Universal Links / App Links** — the `https://` version of invite links (opens
  the app from any browser, falls back to a web page when the app isn't installed)
  needs a **verified domain** hosting an Apple App Site Association file and an
  Android `assetlinks.json`. Blocked on that infrastructure; the custom-scheme link
  above covers the installed-app case in the meantime.

---

## 8. Setup checklist (Supabase)

- [ ] Run `schema.sql` in the SQL Editor.
- [ ] Enable **Email** auth (Authentication → Providers).
- [ ] On sign-up, insert the user's `profiles` row with their chosen role.
- [ ] Run `eas init` (requires `eas login`) so `app.json` gets
      `extra.eas.projectId` — the client push-registration code in
      `lib/notifications.ts` no-ops without it.
- [ ] Deploy the push function: `supabase functions deploy send-activity-push`.
- [ ] Create a Database Webhook (Database → Webhooks) on `activities` INSERT
      that calls `send-activity-push`. (Wraps a `pg_net` trigger — no SQL
      migration needed, so it isn't in `schema.sql`.)
- [ ] (Later) Create a Storage bucket for activity photos.

> Note: the unique index on active invite codes uses `where status = 'pending'`, so
> expired/redeemed codes free up and the 6-digit space won't exhaust.
