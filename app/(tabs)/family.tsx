import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, RoleColors, Spacing } from '@/constants/theme';
import { useAuth, type UserRole } from '@/contexts/auth-provider';
import { addChild, createFamily, fetchChildren, fetchMyFamily } from '@/lib/families';
import {
  createInvite,
  fetchInvites,
  redeemInvite,
  revokeInvite,
  type Invitation,
} from '@/lib/invitations';

const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  no_profile: 'Your profile could not be found. Try signing out and back in.',
  invalid_code: 'That code is invalid or has already been used.',
  expired: 'That code has expired. Ask for a new one.',
  role_mismatch: 'This code is for a different role than yours.',
};

function formatAge(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const months = Math.floor(
    (Date.now() - new Date(birthdate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

export default function FamilyScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const buttonColor = profile ? RoleColors[profile.role] : RoleColors.nanny;

  const familyQuery = useQuery({
    queryKey: ['my-family', profile?.id],
    queryFn: () => fetchMyFamily(profile!.role, profile!.id),
    enabled: !!profile,
  });

  const childrenQuery = useQuery({
    queryKey: ['children', familyQuery.data?.id],
    queryFn: () => fetchChildren(familyQuery.data!.id),
    enabled: !!familyQuery.data,
  });

  if (familyQuery.isLoading) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={buttonColor} />
      </ThemedView>
    );
  }

  if (!familyQuery.data) {
    if (profile?.role === 'nanny') {
      return (
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="group-add" size={32} color={buttonColor} />
          </View>
          <ThemedText type="title" style={styles.title}>
            No family yet
          </ThemedText>
          <ThemedText style={styles.centerText}>
            You haven&apos;t been added to a family yet. Enter an invite code from a parent
            below.
          </ThemedText>
          <RedeemInviteForm buttonColor={buttonColor} onJoined={() => familyQuery.refetch()} />
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.logoBadge}>
          <MaterialIcons name="home" size={32} color={buttonColor} />
        </View>
        <CreateFamilyForm buttonColor={buttonColor} onCreated={() => familyQuery.refetch()} />
        <ThemedText style={styles.orDivider}>— or —</ThemedText>
        <RedeemInviteForm buttonColor={buttonColor} onJoined={() => familyQuery.refetch()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ThemedText type="title">{familyQuery.data.name}</ThemedText>

      {childrenQuery.isLoading ? (
        <ActivityIndicator color={buttonColor} style={styles.spacer} />
      ) : (
        <ThemedView style={styles.spacer}>
          {childrenQuery.data?.length ? (
            childrenQuery.data.map((child) => (
              <ThemedView key={child.id} style={styles.childRow}>
                <View style={[styles.avatar, { backgroundColor: buttonColor + '22' }]}>
                  <ThemedText style={[styles.avatarText, { color: buttonColor }]}>
                    {child.full_name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedView style={styles.childInfo}>
                  <ThemedText type="defaultSemiBold">{child.full_name}</ThemedText>
                  {formatAge(child.birthdate) ? (
                    <ThemedText style={styles.ageText}>{formatAge(child.birthdate)}</ThemedText>
                  ) : null}
                </ThemedView>
              </ThemedView>
            ))
          ) : (
            <ThemedText style={styles.emptyText}>No children added yet.</ThemedText>
          )}
        </ThemedView>
      )}

      {profile?.role === 'parent' ? (
        <>
          <AddChildForm
            buttonColor={buttonColor}
            familyId={familyQuery.data.id}
            onAdded={() =>
              queryClient.invalidateQueries({ queryKey: ['children', familyQuery.data!.id] })
            }
          />
          <InvitesSection
            buttonColor={buttonColor}
            familyId={familyQuery.data.id}
            inviterId={profile.id}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function CreateFamilyForm({
  buttonColor,
  onCreated,
}: {
  buttonColor: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createFamily(name.trim()),
    onSuccess: onCreated,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="title" style={styles.title}>
        Create your family
      </ThemedText>
      <ThemedText style={styles.centerText}>
        Give your household a name. You can add children and invite caregivers next.
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Family name"
        placeholderTextColor="#687076"
        value={name}
        onChangeText={setName}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: buttonColor },
          (!name.trim() || mutation.isPending || pressed) && styles.buttonDisabled,
        ]}
        disabled={!name.trim() || mutation.isPending}
        onPress={() => {
          setError(null);
          mutation.mutate();
        }}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Create family</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

function RedeemInviteForm({
  buttonColor,
  onJoined,
}: {
  buttonColor: string;
  onJoined: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => redeemInvite(code.trim()),
    onSuccess: (result) => {
      if (result.ok) {
        setError(null);
        onJoined();
      } else {
        setError(REDEEM_ERROR_MESSAGES[result.error] ?? result.error);
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="defaultSemiBold">Have an invite code?</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="6-digit code"
        placeholderTextColor="#687076"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: buttonColor },
          (code.trim().length !== 6 || mutation.isPending || pressed) && styles.buttonDisabled,
        ]}
        disabled={code.trim().length !== 6 || mutation.isPending}
        onPress={() => {
          setError(null);
          mutation.mutate();
        }}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Join family</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

function AddChildForm({
  buttonColor,
  familyId,
  onAdded,
}: {
  buttonColor: string;
  familyId: string;
  onAdded: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => addChild(familyId, fullName.trim(), birthdate.trim() || null),
    onSuccess: () => {
      setFullName('');
      setBirthdate('');
      setIsOpen(false);
      onAdded();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!isOpen) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonIconRow,
          { backgroundColor: buttonColor },
          pressed && styles.buttonDisabled,
          styles.spacer,
        ]}
        onPress={() => setIsOpen(true)}>
        <MaterialIcons name="add" size={18} color="#fff" />
        <ThemedText style={styles.buttonText}>Add child</ThemedText>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.spacer}>
      <TextInput
        style={styles.input}
        placeholder="Child's name"
        placeholderTextColor="#687076"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Birthdate YYYY-MM-DD (optional)"
        placeholderTextColor="#687076"
        value={birthdate}
        onChangeText={setBirthdate}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: buttonColor },
          (!fullName.trim() || mutation.isPending || pressed) && styles.buttonDisabled,
        ]}
        disabled={!fullName.trim() || mutation.isPending}
        onPress={() => {
          setError(null);
          mutation.mutate();
        }}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Save child</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

function InvitesSection({
  buttonColor,
  familyId,
  inviterId,
}: {
  buttonColor: string;
  familyId: string;
  inviterId: string;
}) {
  const queryClient = useQueryClient();

  const invitesQuery = useQuery({
    queryKey: ['invites', familyId],
    queryFn: () => fetchInvites(familyId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invites', familyId] });

  return (
    <ThemedView style={styles.spacer}>
      <ThemedText type="subtitle">Invitations</ThemedText>

      {invitesQuery.isLoading ? (
        <ActivityIndicator style={styles.spacer} />
      ) : invitesQuery.data?.length ? (
        invitesQuery.data.map((invite) => (
          <InviteRow key={invite.id} invite={invite} onRevoked={invalidate} />
        ))
      ) : (
        <ThemedText style={styles.spacer}>No pending invites.</ThemedText>
      )}

      <CreateInviteForm
        buttonColor={buttonColor}
        familyId={familyId}
        inviterId={inviterId}
        onCreated={invalidate}
      />
    </ThemedView>
  );
}

function InviteRow({ invite, onRevoked }: { invite: Invitation; onRevoked: () => void }) {
  const mutation = useMutation({
    mutationFn: () => revokeInvite(invite.id),
    onSuccess: onRevoked,
  });

  return (
    <ThemedView style={styles.inviteRow}>
      <View style={styles.inviteIconBadge}>
        <MaterialIcons
          name={invite.invited_role === 'nanny' ? 'volunteer-activism' : 'escalator-warning'}
          size={20}
          color="#687076"
        />
      </View>
      <ThemedView style={styles.inviteInfo}>
        <ThemedText type="defaultSemiBold" style={styles.codeText}>
          {invite.code}
        </ThemedText>
        <ThemedText style={styles.ageText}>
          {invite.invited_role === 'nanny' ? 'Nanny' : 'Co-parent'} · expires{' '}
          {new Date(invite.expires_at).toLocaleDateString()}
        </ThemedText>
      </ThemedView>
      <Pressable disabled={mutation.isPending} onPress={() => mutation.mutate()}>
        <ThemedText type="link">Revoke</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function CreateInviteForm({
  buttonColor,
  familyId,
  inviterId,
  onCreated,
}: {
  buttonColor: string;
  familyId: string;
  inviterId: string;
  onCreated: () => void;
}) {
  const [role, setRole] = useState<UserRole>('nanny');
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createInvite(familyId, inviterId, role),
    onSuccess: (invite) => {
      setError(null);
      setLastCode(invite.code);
      onCreated();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <ThemedView style={styles.spacer}>
      <ThemedView style={styles.roleRow}>
        <Pressable
          style={[
            styles.roleOption,
            role === 'nanny' && { backgroundColor: RoleColors.nanny, borderColor: RoleColors.nanny },
          ]}
          onPress={() => setRole('nanny')}>
          <MaterialIcons
            name="volunteer-activism"
            size={20}
            color={role === 'nanny' ? '#fff' : '#687076'}
          />
          <ThemedText style={role === 'nanny' ? styles.roleTextSelected : undefined}>
            Nanny
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.roleOption,
            role === 'parent' && {
              backgroundColor: RoleColors.parent,
              borderColor: RoleColors.parent,
            },
          ]}
          onPress={() => setRole('parent')}>
          <MaterialIcons
            name="escalator-warning"
            size={20}
            color={role === 'parent' ? '#fff' : '#687076'}
          />
          <ThemedText style={role === 'parent' ? styles.roleTextSelected : undefined}>
            Co-parent
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      {lastCode ? (
        <ThemedView style={styles.shareCodeBanner}>
          <ThemedText style={styles.centerText}>Share this code:</ThemedText>
          <ThemedText style={styles.codeText}>{lastCode}</ThemedText>
        </ThemedView>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonIconRow,
          { backgroundColor: buttonColor },
          (mutation.isPending || pressed) && styles.buttonDisabled,
        ]}
        disabled={mutation.isPending}
        onPress={() => mutation.mutate()}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MaterialIcons name="person-add-alt" size={18} color="#fff" />
            <ThemedText style={styles.buttonText}>Create invite</ThemedText>
          </>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(10, 126, 164, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  centerText: {
    marginBottom: Spacing.sm,
  },
  emptyText: {
    opacity: 0.7,
  },
  orDivider: {
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  error: {
    color: '#d33',
    marginBottom: Spacing.sm,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: Radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonIconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  spacer: {
    marginTop: Spacing.lg,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 16,
  },
  childInfo: {
    flex: 1,
  },
  ageText: {
    opacity: 0.7,
    fontSize: 13,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  inviteIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(104, 112, 118, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInfo: {
    flex: 1,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  shareCodeBanner: {
    backgroundColor: 'rgba(10, 126, 164, 0.08)',
    borderRadius: Radii.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: Radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  roleTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
