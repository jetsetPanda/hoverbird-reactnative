import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/contexts/auth-provider';

export type Invitation = {
  id: string;
  code: string;
  family_id: string;
  inviter_id: string;
  invited_role: UserRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
};

export type RedeemResult =
  | { ok: true; family_id: string; role: UserRole }
  | { ok: false; error: 'no_profile' | 'invalid_code' | 'expired' | 'role_mismatch' };

export async function fetchInvites(familyId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invitation[];
}

export async function createInvite(
  familyId: string,
  inviterId: string,
  invitedRole: UserRole
): Promise<Invitation> {
  const { data: code, error: codeError } = await supabase.rpc('generate_invite_code');
  if (codeError) throw codeError;

  const { data, error } = await supabase
    .from('invitations')
    .insert({ family_id: familyId, inviter_id: inviterId, invited_role: invitedRole, code })
    .select()
    .single();
  if (error) throw error;
  return data as Invitation;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', inviteId);
  if (error) throw error;
}

export async function redeemInvite(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}
