-- Activity photos: private Storage bucket + RLS --------------------------------
-- Post-MVP feature from docs/architecture.md §7 ("Activity photos — wire
-- media_urls to Supabase Storage + image picker").
--
-- Objects are keyed by convention:  <family_id>/<filename>
-- so the policies below can derive the family from the FIRST path segment and
-- reuse the existing schema.sql RLS helpers (has_family_access,
-- is_family_caregiver). activities.media_urls stores these storage PATHS (not
-- URLs) — the bucket is PRIVATE because these are photos of children, and the
-- app renders them via short-lived signed URLs only.

insert into storage.buckets (id, name, public)
values ('activity-media', 'activity-media', false)
on conflict (id) do nothing;

-- First path segment of an object name, as a family uuid. Returns null when
-- the name doesn't follow the <family_id>/<filename> convention, so the
-- policies below simply deny instead of erroring on a bad uuid cast (policies
-- on storage.objects are evaluated for every bucket's rows).
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
