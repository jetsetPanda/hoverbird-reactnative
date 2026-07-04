import { supabase } from '@/lib/supabase';

export type ActivityTemplate = {
  id: string;
  key: string;
  label: string;
  category: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Activity = {
  id: string;
  child_id: string;
  logged_by: string;
  template_key: string | null;
  category: string;
  note: string | null;
  media_urls: string[];
  occurred_at: string;
  created_at: string;
  children?: { full_name: string } | null;
  activity_templates?: { label: string } | null;
  activity_children?: { children: { id: string; full_name: string } | null }[];
};

// All child names on an activity, primary child first. Falls back to the
// embedded primary child for rows that predate the activity_children backfill
// (or were inserted by an old client during rollout).
export function activityChildNames(activity: Activity): string[] {
  const names = (activity.activity_children ?? [])
    .map((row) => row.children?.full_name)
    .filter((name): name is string => !!name);
  if (names.length > 0) return names;
  return activity.children?.full_name ? [activity.children.full_name] : [];
}

export async function fetchTemplates(): Promise<ActivityTemplate[]> {
  const { data, error } = await supabase
    .from('activity_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data as ActivityTemplate[];
}

export async function fetchActivities(childIds: string[]): Promise<Activity[]> {
  if (childIds.length === 0) return [];
  // Filter through the activity_children join table so an activity logged for
  // several siblings shows up once with ALL its children. The aliased
  // `child_filter` embed exists only to filter the top-level rows (!inner +
  // .in) — the unfiltered `activity_children` embed keeps the complete child
  // list even when only one of them matched the filter.
  const { data, error } = await supabase
    .from('activities')
    .select(
      '*, children(full_name), activity_templates(label), activity_children(children(id, full_name)), child_filter:activity_children!inner(child_id)'
    )
    .in('child_filter.child_id', childIds)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return data as Activity[];
}

// Live-updates the feed: invalidating on every change (rather than patching
// the cache directly) keeps this in sync with whatever filters/joins the
// query already applies.
export function subscribeToActivities(childIds: string[], onChange: () => void) {
  if (childIds.length === 0) return () => {};

  const channel = supabase
    .channel(`activities-${childIds.join(',')}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activities' },
      (payload) => {
        const childId = (payload.new as { child_id?: string })?.child_id;
        if (childId && childIds.includes(childId)) onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function logActivity(params: {
  childIds: string[];
  loggedBy: string;
  templateKey: string | null;
  category: string;
  note: string | null;
  // Storage PATHS in the private 'activity-media' bucket (see lib/media.ts),
  // never URLs — the feed resolves them to short-lived signed URLs.
  mediaUrls?: string[];
}): Promise<Activity> {
  const [primaryChildId] = params.childIds;
  if (!primaryChildId) throw new Error('logActivity requires at least one child');

  // child_id stays populated with the primary (first-selected) child so the
  // realtime publication and the push function keep working; the full child
  // set goes into activity_children.
  const { data, error } = await supabase
    .from('activities')
    .insert({
      child_id: primaryChildId,
      logged_by: params.loggedBy,
      template_key: params.templateKey,
      category: params.category,
      note: params.note,
      media_urls: params.mediaUrls ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  const activity = data as Activity;

  const { error: joinError } = await supabase
    .from('activity_children')
    .insert(params.childIds.map((childId) => ({ activity_id: activity.id, child_id: childId })));
  if (joinError) {
    // Don't leave a half-logged activity behind: remove it (RLS lets the
    // logging nanny delete her own rows) and surface the failure.
    await supabase.from('activities').delete().eq('id', activity.id);
    throw joinError;
  }

  return activity;
}
