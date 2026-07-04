// Triggered by a Database Webhook on INSERT into `activities` (see setup
// checklist in docs/architecture.md). Looks up the child's family, finds the
// parents' push tokens, and sends an Expo push for the new activity.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type WebhookPayload = {
  type: 'INSERT';
  table: 'activities';
  schema: 'public';
  record: {
    id: string;
    child_id: string;
    logged_by: string;
    template_key: string | null;
    category: string;
    note: string | null;
  };
};

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const activity = payload.record;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Multi-sibling logging: the full child set lives in activity_children.
  // Fall back to the primary child_id when there are no join rows — either a
  // pre-migration activity or a race where the webhook fired before the
  // client inserted the join rows.
  const { data: joinRows } = await supabase
    .from('activity_children')
    .select('child_id, children(full_name, family_id)')
    .eq('activity_id', activity.id);

  let children = (joinRows ?? [])
    // Primary child (activities.child_id) first, so the title leads with the
    // child the nanny selected first.
    .sort((a, b) => Number(b.child_id === activity.child_id) - Number(a.child_id === activity.child_id))
    .map((row) => row.children as unknown as { full_name: string; family_id: string } | null)
    .filter((c): c is { full_name: string; family_id: string } => !!c);

  if (children.length === 0) {
    const { data: child } = await supabase
      .from('children')
      .select('full_name, family_id')
      .eq('id', activity.child_id)
      .single();
    if (child) children = [child];
  }
  if (children.length === 0) return Response.json({ ok: false, error: 'child_not_found' });

  const names = children.map((c) => c.full_name);
  const childLine =
    names.length <= 2 ? names.join(' & ') : `${names[0]} +${names.length - 1}`;
  const familyId = children[0].family_id;

  const [{ data: nanny }, { data: template }, { data: parents }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', activity.logged_by).single(),
    activity.template_key
      ? supabase.from('activity_templates').select('label').eq('key', activity.template_key).single()
      : Promise.resolve({ data: null }),
    supabase.from('family_members').select('profile_id').eq('family_id', familyId),
  ]);

  const parentIds = (parents ?? []).map((p) => p.profile_id);
  if (parentIds.length === 0) return Response.json({ ok: true, sent: 0 });

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('profile_id', parentIds);
  if (!tokens || tokens.length === 0) return Response.json({ ok: true, sent: 0 });

  const what = template?.label ?? activity.note ?? activity.category;
  const messages = tokens.map(({ token }) => ({
    to: token,
    title: childLine,
    body: `${nanny?.full_name ?? 'Your nanny'} logged: ${what}`,
    data: { activityId: activity.id, childId: activity.child_id },
    sound: 'default',
  }));

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  return Response.json({ ok: expoRes.ok, sent: messages.length });
});
