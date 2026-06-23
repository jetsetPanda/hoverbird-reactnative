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
};

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
  const { data, error } = await supabase
    .from('activities')
    .select('*, children(full_name), activity_templates(label)')
    .in('child_id', childIds)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return data as Activity[];
}

export async function logActivity(params: {
  childId: string;
  loggedBy: string;
  templateKey: string | null;
  category: string;
  note: string | null;
}): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      child_id: params.childId,
      logged_by: params.loggedBy,
      template_key: params.templateKey,
      category: params.category,
      note: params.note,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}
