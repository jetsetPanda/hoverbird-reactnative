-- Without this, postgres_changes subscriptions on `activities` never fire —
-- the table isn't part of the realtime publication by default.
alter publication supabase_realtime add table activities;
