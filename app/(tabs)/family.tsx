import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, RoleColors, Spacing, TabBarClearance } from '@/constants/theme';
import { useAuth, type UserRole } from '@/contexts/auth-provider';
import {
  addChild,
  createFamily,
  fetchChildren,
  fetchMyFamily,
  updateChild,
  type Child,
} from '@/lib/families';
import {
  createInvite,
  fetchInvites,
  redeemInvite,
  revokeInvite,
  type Invitation,
} from '@/lib/invitations';
import { clearPendingInviteCode, getPendingInviteCode } from '@/lib/pending-invite';
import { noClip } from '@/lib/text';

const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  no_profile: 'Your profile could not be found. Try signing out and back in.',
  invalid_code: 'That code is invalid or has already been used.',
  expired: 'That code has expired. Ask for a new one.',
  role_mismatch: 'This code is for a different role than yours.',
};

// Opens the system share sheet with a ready-to-send invite message. Share is
// built into RN (no clipboard dependency — that would need a native rebuild).
// Includes a deep link (custom scheme) that opens the app straight to the
// prefilled redeem form, plus the raw code as a fallback.
function shareInviteCode(code: string, role: UserRole, familyName: string) {
  const link = Linking.createURL('/', { queryParams: { code } });
  Share.share({
    message:
      `You're invited to join ${familyName} on Hoverbird as a ${
        role === 'nanny' ? 'nanny' : 'co-parent'
      }.\n\n` +
      `Open the app with this link:\n${link}\n\n` +
      `Already have the app open? Enter code ${code}.`,
  }).catch(() => {});
}

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
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
          keyboardShouldPersistTaps="handled">
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
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoBadge}>
          <MaterialIcons name="home" size={32} color={buttonColor} />
        </View>
        <CreateFamilyForm buttonColor={buttonColor} onCreated={() => familyQuery.refetch()} />
        <ThemedText style={styles.orDivider}>— or —</ThemedText>
        <RedeemInviteForm buttonColor={buttonColor} onJoined={() => familyQuery.refetch()} />
      </ScrollView>
    );
  }

  const onRefresh = async () => {
    await Promise.all([
      familyQuery.refetch(),
      childrenQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['invites'] }),
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
      refreshControl={
        <RefreshControl refreshing={familyQuery.isRefetching} onRefresh={onRefresh} />
      }
      keyboardShouldPersistTaps="handled">
      <ThemedText type="title">{familyQuery.data.name}</ThemedText>

      {childrenQuery.isLoading ? (
        <ActivityIndicator color={buttonColor} style={styles.spacer} />
      ) : (
        <ThemedView style={styles.childList}>
          {childrenQuery.data?.length ? (
            childrenQuery.data.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                buttonColor={buttonColor}
                canEdit={profile?.role === 'parent'}
                onUpdated={() =>
                  queryClient.invalidateQueries({ queryKey: ['children', familyQuery.data!.id] })
                }
              />
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
            familyName={familyQuery.data.name}
            inviterId={profile.id}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function ChildRow({
  child,
  buttonColor,
  canEdit,
  onUpdated,
}: {
  child: Child;
  buttonColor: string;
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(child.full_name);
  const [birthdate, setBirthdate] = useState(child.birthdate ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateChild(child.id, fullName.trim(), birthdate.trim() || null),
    onSuccess: () => {
      setError(null);
      setIsEditing(false);
      onUpdated();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isEditing) {
    return (
      <ThemedView style={styles.editCard}>
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

        <ThemedView style={styles.editActions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonDisabled]}
            disabled={mutation.isPending}
            onPress={() => {
              setFullName(child.full_name);
              setBirthdate(child.birthdate ?? '');
              setError(null);
              setIsEditing(false);
            }}>
            <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.flex1,
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
              <ThemedText style={styles.buttonText}>Save</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.childRow}>
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
      {canEdit ? (
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${child.full_name}`}
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => setIsEditing(true)}>
          <MaterialIcons name="edit" size={20} color={buttonColor} />
        </Pressable>
      ) : null}
    </ThemedView>
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

  // Prefill from a code captured off a deep link (see lib/pending-invite.ts).
  // Non-destructive read — cleared only after a successful join below — so the
  // code isn't lost if the user backgrounds the app before submitting.
  useEffect(() => {
    getPendingInviteCode().then((pending) => {
      if (pending) setCode(pending);
    });
  }, []);

  const mutation = useMutation({
    mutationFn: () => redeemInvite(code.trim()),
    onSuccess: (result) => {
      if (result.ok) {
        setError(null);
        clearPendingInviteCode();
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

      <ThemedView style={styles.editActions}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonDisabled]}
          disabled={mutation.isPending}
          onPress={() => {
            setFullName('');
            setBirthdate('');
            setError(null);
            setIsOpen(false);
          }}>
          <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.flex1,
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
    </ThemedView>
  );
}

function InvitesSection({
  buttonColor,
  familyId,
  familyName,
  inviterId,
}: {
  buttonColor: string;
  familyId: string;
  familyName: string;
  inviterId: string;
}) {
  const queryClient = useQueryClient();

  const invitesQuery = useQuery({
    queryKey: ['invites', familyId],
    queryFn: () => fetchInvites(familyId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invites', familyId] });

  return (
    <ThemedView style={styles.invitesSection}>
      <ThemedText type="subtitle">Invitations</ThemedText>

      {invitesQuery.isLoading ? (
        <ActivityIndicator style={styles.spacer} />
      ) : invitesQuery.data?.length ? (
        invitesQuery.data.map((invite) => (
          <InviteRow key={invite.id} invite={invite} familyName={familyName} onRevoked={invalidate} />
        ))
      ) : (
        <ThemedText style={styles.emptyText}>No pending invites.</ThemedText>
      )}

      <CreateInviteForm
        buttonColor={buttonColor}
        familyId={familyId}
        familyName={familyName}
        inviterId={inviterId}
        onCreated={invalidate}
      />
    </ThemedView>
  );
}

function InviteRow({
  invite,
  familyName,
  onRevoked,
}: {
  invite: Invitation;
  familyName: string;
  onRevoked: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => revokeInvite(invite.id),
    onSuccess: onRevoked,
  });

  return (
    <ThemedView style={styles.inviteRow}>
      <View style={styles.inviteIconBadge}>
        <MaterialIcons
          name={invite.invited_role === 'nanny' ? 'volunteer-activism' : 'supervisor-account'}
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
        <View style={styles.inviteActions}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Share invite code ${invite.code}`}
            style={({ pressed }) => [styles.inviteAction, pressed && styles.pressed]}
            onPress={() => shareInviteCode(invite.code, invite.invited_role, familyName)}>
            <MaterialIcons name="share" size={16} color="#0a7ea4" />
            <ThemedText type="link">{noClip('Share')}</ThemedText>
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Revoke this invite"
            disabled={mutation.isPending}
            style={({ pressed }) => [styles.inviteAction, pressed && styles.pressed]}
            onPress={() => mutation.mutate()}>
            <MaterialIcons name="delete-outline" size={16} color="#d33" />
            <ThemedText type="link" style={styles.revokeLinkText}>
              {noClip('Revoke')}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </ThemedView>
  );
}

function CreateInviteForm({
  buttonColor,
  familyId,
  familyName,
  inviterId,
  onCreated,
}: {
  buttonColor: string;
  familyId: string;
  familyName: string;
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
    <ThemedView style={styles.inviteForm}>
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
          <ThemedText style={[styles.roleText, role === 'nanny' && styles.roleTextSelected]}>
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
            name="supervisor-account"
            size={20}
            color={role === 'parent' ? '#fff' : '#687076'}
          />
          <ThemedText style={[styles.roleText, role === 'parent' && styles.roleTextSelected]}>
            Co-parent
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      {lastCode ? (
        <ThemedView style={styles.shareCodeBanner}>
          <ThemedText style={styles.centerText}>Share this code:</ThemedText>
          <ThemedText style={styles.codeText}>{lastCode}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share invite code ${lastCode}`}
            style={({ pressed }) => [
              styles.button,
              styles.buttonIconRow,
              styles.shareCodeButton,
              { backgroundColor: buttonColor },
              pressed && styles.buttonDisabled,
            ]}
            onPress={() => shareInviteCode(lastCode, role, familyName)}>
            <MaterialIcons name="share" size={16} color="#fff" />
            <ThemedText style={styles.buttonText}>Share code</ThemedText>
          </Pressable>
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
    paddingBottom: TabBarClearance,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
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
  secondaryButton: {
    borderRadius: Radii.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#687076',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  flex1: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  editCard: {
    borderWidth: 1,
    borderColor: 'rgba(104, 112, 118, 0.25)',
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  spacer: {
    marginTop: Spacing.lg,
  },
  childList: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  invitesSection: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  inviteForm: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
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
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
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
    gap: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  inviteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revokeLinkText: {
    color: '#d33',
  },
  shareCodeButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
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
  roleText: {
    // Fill the pill width (rather than shrink-wrapping) so Android/Fabric
    // doesn't clip the trailing glyph ("Co-paren"); textAlign keeps it centered.
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  roleTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
