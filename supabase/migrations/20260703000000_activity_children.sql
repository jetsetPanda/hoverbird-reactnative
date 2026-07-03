-- Multi-sibling logging (docs/architecture.md §7): one activity can now be
-- logged against multiple children via the activity_children join table.
-- activities.child_id stays populated as the "primary" child (the first one
-- selected) so existing queries, the realtime publication, and the deployed
-- send-activity-push function keep working during rollout — nothing is
-- dropped or nulled out.

-- activity_children: activity ↔ child (M:N) ----------------------------------
create table activity_children (
  activity_id uuid not null references activities(id) on delete cascade,
  child_id    uuid not null references children(id) on delete cascade,
  primary key (activity_id, child_id)
);
create index idx_activity_children_child on activity_children(child_id);

alter table activity_children enable row level security;

-- Mirrors the activities policies: parents AND nannies linked to the child's
-- family can READ; only an assigned caregiver can WRITE, and only rows for
-- activities they logged themselves. Rows are removed via the on-delete
-- cascade when an activity is deleted, so no delete/update policy is needed.
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

-- Backfill: every existing activity gets one join row for its single child.
insert into activity_children (activity_id, child_id)
select id, child_id from activities
on conflict do nothing;
