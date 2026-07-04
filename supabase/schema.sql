-- =============================================================================
-- Nanny ↔ Parent Activity Logging — Supabase Schema (MVP)
-- =============================================================================
-- Run this in the Supabase SQL Editor (or as a migration).
-- Decisions baked in:
--   • Roles: parent | nanny
--   • Many-to-many: nanny↔many families, many nannies↔one family, multi-parent
--   • Invitations via 6-digit code (no deep links — revisit post-launch)
--   • Multi-sibling logging via activity_children join table; activities.child_id
--     stays populated as the "primary" (first-selected) child for compatibility
--   • Photos: media_urls stores Supabase Storage PATHS in the private
--     'activity-media' bucket (see STORAGE section at the end)
-- =============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- Enums -----------------------------------------------------------------------
create type user_role as enum ('parent', 'nanny');
create type member_role as enum ('parent', 'guardian');
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type activity_category as enum (
  'meal', 'nap', 'play', 'learning', 'diaper', 'outdoor', 'mood', 'milestone', 'other'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles: extends auth.users (1:1) -----------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null,
  full_name   text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- families: a household unit --------------------------------------------------
create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- children: belong to exactly one family --------------------------------------
create table children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  full_name   text not null,
  birthdate   date,                       -- powers age-based milestone suggestions later
  avatar_url  text,
  created_at  timestamptz not null default now()
);
create index idx_children_family on children(family_id);

-- family_members: parents/guardians ↔ family (M:N) ---------------------------
create table family_members (
  family_id   uuid not null references families(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        member_role not null default 'parent',
  created_at  timestamptz not null default now(),
  primary key (family_id, profile_id)
);
create index idx_family_members_profile on family_members(profile_id);

-- caregiver_assignments: nanny ↔ family (M:N) --------------------------------
-- Assigning at the family level (not per-child) keeps MVP simple; a nanny
-- assigned to a family can log for any child in it.
create table caregiver_assignments (
  family_id   uuid not null references families(id) on delete cascade,
  nanny_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (family_id, nanny_id)
);
create index idx_caregiver_nanny on caregiver_assignments(nanny_id);

-- invitations: 6-digit code join flow (either side can invite) ---------------
create table invitations (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,                       -- 6-digit, see helper below
  family_id     uuid not null references families(id) on delete cascade,
  inviter_id    uuid not null references profiles(id),
  invited_role  user_role not null,                  -- the role the redeemer will take
  status        invite_status not null default 'pending',
  expires_at    timestamptz not null default (now() + interval '72 hours'),
  redeemed_by   uuid references profiles(id),
  redeemed_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- Only one ACTIVE (pending) invite per code at a time → prevents collisions.
create unique index idx_invitations_active_code
  on invitations(code) where status = 'pending';
create index idx_invitations_family on invitations(family_id);

-- activity_templates: tap-to-log presets -------------------------------------
create table activity_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,        -- stable identifier, e.g. 'ate_lunch'
  label       text not null,               -- display text, e.g. 'Ate lunch'
  category    activity_category not null,
  icon        text,                        -- optional icon name for the UI
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

-- activities: the heart of the app --------------------------------------------
-- child_id is the "primary" child (the first one selected when logging); the
-- full set of children lives in activity_children below. Keeping child_id
-- populated preserves existing queries, the realtime publication, and the
-- deployed push function.
create table activities (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  logged_by    uuid not null references profiles(id),  -- the nanny
  template_key text references activity_templates(key), -- null when free-text/custom
  category     activity_category not null,
  note         text,                                    -- free-text detail
  media_urls   text[] not null default '{}',            -- storage PATHS in 'activity-media' (see STORAGE section)
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index idx_activities_child_time on activities(child_id, occurred_at desc);
create index idx_activities_logged_by on activities(logged_by);

-- activity_children: activity ↔ child (M:N) -----------------------------------
-- Multi-sibling logging: one activity can be logged against several children
-- at once. Every activity has at least the row for its primary child_id.
create table activity_children (
  activity_id uuid not null references activities(id) on delete cascade,
  child_id    uuid not null references children(id) on delete cascade,
  primary key (activity_id, child_id)
);
create index idx_activity_children_child on activity_children(child_id);

-- push_tokens: Expo push tokens per device, owned by a profile --------------
-- A profile can have multiple rows (multiple devices). The Edge Function that
-- sends pushes on new activities reads from here.
create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  token       text not null unique,
  platform    text not null,                  -- 'ios' | 'android'
  created_at  timestamptz not null default now()
);
create index idx_push_tokens_profile on push_tokens(profile_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Generate a unique 6-digit invitation code (retries on rare collision) ------
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  new_code text;
begin
  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from invitations where code = new_code and status = 'pending'
    );
  end loop;
  return new_code;
end;
$$;

-- Membership predicates used throughout RLS ----------------------------------
create or replace function is_family_member(fam uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from family_members
    where family_id = fam and profile_id = auth.uid()
  );
$$;

create or replace function is_family_caregiver(fam uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from caregiver_assignments
    where family_id = fam and nanny_id = auth.uid()
  );
$$;

-- True if the current user is linked to the family in EITHER role ------------
create or replace function has_family_access(fam uuid)
returns boolean language sql security definer stable as $$
  select is_family_member(fam) or is_family_caregiver(fam);
$$;

-- The family a given child belongs to ----------------------------------------
create or replace function family_of_child(c uuid)
returns uuid language sql security definer stable as $$
  select family_id from children where id = c;
$$;

-- True if the current user created the given family ---------------------------
-- security definer because the caller has no family_members row yet at the
-- moment this is checked (see "self-join as creator" below) — without this,
-- the policy's own subquery against `families` would be blocked by RLS.
create or replace function is_family_creator(fam uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from families where id = fam and created_by = auth.uid()
  );
$$;

-- =============================================================================
-- updated_at trigger
-- =============================================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_profiles_touch
  before update on profiles
  for each row execute function touch_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
alter table profiles               enable row level security;
alter table families               enable row level security;
alter table children               enable row level security;
alter table family_members         enable row level security;
alter table caregiver_assignments  enable row level security;
alter table invitations            enable row level security;
alter table activity_templates     enable row level security;
alter table activities             enable row level security;
alter table activity_children      enable row level security;
alter table push_tokens            enable row level security;

-- profiles --------------------------------------------------------------------
-- Anyone authenticated can read profiles (needed to show names in feeds/invites).
create policy "read profiles"
  on profiles for select using (auth.role() = 'authenticated');
create policy "insert own profile"
  on profiles for insert with check (id = auth.uid());
create policy "update own profile"
  on profiles for update using (id = auth.uid());

-- families --------------------------------------------------------------------
create policy "read families you belong to"
  on families for select using (has_family_access(id));
create policy "create a family"
  on families for insert with check (created_by = auth.uid());
create policy "members update their family"
  on families for update using (is_family_member(id));

-- children --------------------------------------------------------------------
create policy "read children in your families"
  on children for select using (has_family_access(family_id));
create policy "parents add children"
  on children for insert with check (is_family_member(family_id));
create policy "parents update children"
  on children for update using (is_family_member(family_id));
create policy "parents delete children"
  on children for delete using (is_family_member(family_id));

-- family_members --------------------------------------------------------------
create policy "read membership of your families"
  on family_members for select using (has_family_access(family_id));
-- Insert is normally done via invitation redemption (security-definer fn),
-- but the family creator may seed themselves as the first member.
create policy "self-join as creator"
  on family_members for insert
  with check (
    profile_id = auth.uid()
    and is_family_creator(family_id)
  );

-- caregiver_assignments -------------------------------------------------------
create policy "read assignments of your families"
  on caregiver_assignments for select using (has_family_access(family_id));
-- (Assignment rows are created via invitation redemption — see Edge Function.)

-- invitations -----------------------------------------------------------------
-- A family member can create + view invites for their family.
create policy "members read family invites"
  on invitations for select using (is_family_member(family_id));
create policy "members create invites"
  on invitations for insert with check (
    inviter_id = auth.uid() and is_family_member(family_id)
  );
create policy "members revoke invites"
  on invitations for update using (is_family_member(family_id));
-- NOTE: redemption (a stranger entering a code) must NOT require family access,
-- so it is handled by a SECURITY DEFINER function / Edge Function, not by RLS.

-- activity_templates ----------------------------------------------------------
create policy "anyone reads templates"
  on activity_templates for select using (auth.role() = 'authenticated');

-- activities ------------------------------------------------------------------
-- Parents AND nannies linked to the child's family can READ.
create policy "read activities in your families"
  on activities for select using (has_family_access(family_of_child(child_id)));
-- Only an assigned caregiver (nanny) can WRITE, and only as themselves.
create policy "caregivers log activities"
  on activities for insert with check (
    logged_by = auth.uid()
    and is_family_caregiver(family_of_child(child_id))
  );
create policy "caregivers edit own activities"
  on activities for update using (
    logged_by = auth.uid()
    and is_family_caregiver(family_of_child(child_id))
  );
create policy "caregivers delete own activities"
  on activities for delete using (
    logged_by = auth.uid()
    and is_family_caregiver(family_of_child(child_id))
  );

-- activity_children -------------------------------------------------------
-- Mirrors the activities policies: family read, caregiver-only write (and only
-- rows for activities they logged themselves). Rows are removed via the
-- on-delete cascade when an activity is deleted, so no delete policy is needed.
create policy "read activity children in your families"
  on activity_children for select using (has_family_access(family_of_child(child_id)));
create policy "caregivers link activity children"
  on activity_children for insert with check (
    is_family_caregiver(family_of_child(child_id))
    and exists (
      select 1 from activities a
      where a.id = activity_id and a.logged_by = auth.uid()
    )
  );

-- push_tokens -------------------------------------------------------------
-- Owner-only: a profile manages only its own device tokens. The push-sending
-- Edge Function reads this table with the service role key, bypassing RLS.
create policy "manage own push tokens"
  on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- =============================================================================
-- REDEMPTION FUNCTION (callable by anyone authenticated)
-- =============================================================================
-- Bypasses RLS safely: validates the code, then creates the right join row.
create or replace function redeem_invite(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv invitations%rowtype;
  me  profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  select * into inv from invitations
   where code = p_code and status = 'pending'
   for update;

  if inv.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if inv.expires_at < now() then
    update invitations set status = 'expired' where id = inv.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if inv.invited_role <> me.role then
    return jsonb_build_object('ok', false, 'error', 'role_mismatch');
  end if;

  if me.role = 'parent' then
    insert into family_members(family_id, profile_id, role)
      values (inv.family_id, me.id, 'parent')
      on conflict do nothing;
  else
    insert into caregiver_assignments(family_id, nanny_id)
      values (inv.family_id, me.id)
      on conflict do nothing;
  end if;

  update invitations
     set status = 'accepted', redeemed_by = me.id, redeemed_at = now()
   where id = inv.id;

  return jsonb_build_object('ok', true, 'family_id', inv.family_id, 'role', me.role);
end;
$$;

-- =============================================================================
-- CREATE FAMILY RPC (callable by any authenticated parent)
-- =============================================================================
-- Same bootstrap problem as redeem_invite: the caller has no family_members
-- row until this runs, so a plain client-side insert+select can't satisfy the
-- families/family_members RLS read policies. Do both inserts atomically here,
-- as the function owner, and return the row directly.
create or replace function create_family(p_name text)
returns families
language plpgsql
security definer
as $$
declare
  fam families%rowtype;
begin
  insert into families(name, created_by) values (p_name, auth.uid())
    returning * into fam;

  insert into family_members(family_id, profile_id, role)
    values (fam.id, auth.uid(), 'parent');

  return fam;
end;
$$;

-- =============================================================================
-- STORAGE: activity photos ('activity-media' bucket)
-- =============================================================================
-- Applied via supabase/migrations/20260703000000_activity_media_storage.sql —
-- mirrored here because this file is the source of truth for the data model.
--
-- Objects are keyed by convention <family_id>/<filename>, so RLS derives the
-- family from the first path segment and reuses the helpers above.
-- activities.media_urls stores these storage PATHS (never URLs): the bucket is
-- PRIVATE (photos of children) and the app renders via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('activity-media', 'activity-media', false)
on conflict (id) do nothing;

-- First path segment of an object name, as a family uuid (null when the name
-- doesn't follow the convention → policies deny instead of erroring on cast).
create or replace function public.storage_family_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

-- Only an assigned nanny of the family may upload into that family's folder.
create policy "caregivers upload activity media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'activity-media'
    and public.is_family_caregiver(public.storage_family_id(name))
  );

-- Anyone linked to the family (parent or nanny) may read its photos — this is
-- what authorizes createSignedUrl/download for feed rendering.
create policy "family reads activity media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'activity-media'
    and public.has_family_access(public.storage_family_id(name))
  );

-- No update/delete policies on purpose: the app has no photo edit/remove UI
-- yet, so nobody can mutate or destroy uploaded photos through the client.

-- =============================================================================
-- SEED: activity templates (tap-to-log presets)
-- =============================================================================
insert into activity_templates(key, label, category, icon, sort_order) values
  ('ate_breakfast', 'Ate breakfast',      'meal',      'sunrise',    10),
  ('ate_lunch',     'Ate lunch',          'meal',      'utensils',   11),
  ('ate_snack',     'Had a snack',        'meal',      'apple',      12),
  ('drank_bottle',  'Drank a bottle',     'meal',      'milk',       13),
  ('napped',        'Took a nap',         'nap',       'moon',       20),
  ('diaper_change', 'Diaper change',      'diaper',    'refresh',    30),
  ('read_book',     'Read a book',        'learning',  'book',       40),
  ('learned_word',  'Learned a new word', 'milestone', 'star',       41),
  ('played_inside', 'Played indoors',     'play',      'blocks',     50),
  ('played_outside','Played outside',     'outdoor',   'tree',       51),
  ('was_happy',     'Was happy',          'mood',      'smile',      60),
  ('was_fussy',     'Was fussy',          'mood',      'frown',      61),
  ('first_steps',   'First steps!',       'milestone', 'footprints', 70),
  ('custom',        'Something else…',    'other',     'plus',       99);
