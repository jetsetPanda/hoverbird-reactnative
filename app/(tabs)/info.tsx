import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Radii,
  RoleColors,
  Spacing,
  TabBarClearance,
  webContentContainer,
  type ThemeColors,
} from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';
import { useThemeColors } from '@/hooks/use-theme-color';

export default function AccountScreen() {
  const { session, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const accent = profile ? RoleColors[profile.role] : RoleColors.nanny;

  const confirmSignOut = () => {
    // Alert.alert is a silent no-op on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out? You can sign back in anytime.')) signOut();
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom + TabBarClearance },
      ]}>
      <View style={[styles.avatar, { backgroundColor: accent + '22' }]}>
        <ThemedText style={[styles.avatarText, { color: accent }]}>
          {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
        </ThemedText>
      </View>

      <ThemedText type="title" style={styles.name}>
        {profile?.full_name}
      </ThemedText>
      {session?.user.email ? (
        <ThemedText style={styles.email}>{session.user.email}</ThemedText>
      ) : null}
      <View style={[styles.roleBadge, { backgroundColor: accent }]}>
        <ThemedText style={styles.roleText}>
          {profile?.role === 'parent' ? 'Parent' : 'Nanny'}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        onPress={confirmSignOut}>
        <MaterialIcons name="logout" size={18} color={c.error} />
        <ThemedText style={styles.signOutText}>Sign out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
      ...webContentContainer,
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
  email: {
    opacity: 0.6,
    marginTop: -Spacing.sm,
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
    borderColor: c.error,
  },
  signOutText: {
    color: c.error,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
