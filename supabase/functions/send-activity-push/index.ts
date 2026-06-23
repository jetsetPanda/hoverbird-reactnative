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

  const { data: child } = await supabase
    .from('children')
    .select('full_name, family_id')
    .eq('id', activity.child_id)
    .single();
  if (!child) return Response.json({ ok: false, error: 'child_not_found' });

  const [{ data: nanny }, { data: template }, { data: parents }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', activity.logged_by).single(),
    activity.template_key
      ? supabase.from('activity_templates').select('label').eq('key', activity.template_key).single()
      : Promise.resolve({ data: null }),
    supabase.from('family_members').select('profile_id').eq('family_id', child.family_id),
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
    title: child.full_name,
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
