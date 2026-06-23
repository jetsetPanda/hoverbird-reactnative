import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/contexts/auth-provider';

export type Family = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type Child = {
  id: string;
  family_id: string;
  full_name: string;
  birthdate: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function fetchMyFamily(role: UserRole, userId: string): Promise<Family | null> {
  if (role === 'parent') {
    const { data, error } = await supabase
      .from('family_members')
      .select('families(*)')
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.families as unknown as Family) ?? null;
  }

  const { data, error } = await supabase
    .from('caregiver_assignments')
    .select('families(*)')
    .eq('nanny_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.families as unknown as Family) ?? null;
}

export async function createFamily(name: string): Promise<Family> {
  // A plain insert+select can't work here: the families/family_members SELECT
  // RLS policies require existing membership, which doesn't exist until this
  // call creates it. create_family is a SECURITY DEFINER RPC that does both
  // inserts atomically and returns the row directly, bypassing that bootstrap
  // problem the same way redeem_invite does for invitation redemption.
  const { data, error } = await supabase.rpc('create_family', { p_name: name });
  if (error) throw error;
  return data as Family;
}

export async function fetchChildren(familyId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Child[];
}

export async function addChild(
  familyId: string,
  fullName: string,
  birthdate: string | null
): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: familyId, full_name: fullName, birthdate })
    .select()
    .single();
  if (error) throw error;
  return data as Child;
}
