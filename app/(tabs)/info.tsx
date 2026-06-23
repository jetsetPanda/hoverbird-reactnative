import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, RoleColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';

export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const accent = profile ? RoleColors[profile.role] : RoleColors.nanny;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.avatar, { backgroundColor: accent + '22' }]}>
        <ThemedText style={[styles.avatarText, { color: accent }]}>
          {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
        </ThemedText>
      </View>

      <ThemedText type="title" style={styles.name}>
        {profile?.full_name}
      </ThemedText>
      <View style={[styles.roleBadge, { backgroundColor: accent }]}>
        <ThemedText style={styles.roleText}>
          {profile?.role === 'parent' ? 'Parent' : 'Nanny'}
        </ThemedText>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        onPress={signOut}>
        <MaterialIcons name="logout" size={18} color="#d33" />
        <ThemedText style={styles.signOutText}>Sign out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
  },
  name: {
    marginTop: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
  },
  roleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#d33',
  },
  signOutText: {
    color: '#d33',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
