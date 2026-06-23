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

alter table push_tokens enable row level security;

-- push_tokens -------------------------------------------------------------
-- Owner-only: a profile manages only its own device tokens. The push-sending
-- Edge Function reads this table with the service role key, bypassing RLS.
create policy "manage own push tokens"
  on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
