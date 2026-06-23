import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, RoleColors } from '@/constants/theme';
import { useAuth, type UserRole } from '@/contexts/auth-provider';

export default function CompleteProfileScreen() {
  const { completeProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!role) return;
    setError(null);
    setIsSubmitting(true);
    const result = await completeProfile({ fullName: fullName.trim(), role });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
    // On success the root layout routes to (tabs) automatically.
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ThemedText type="title" style={styles.title}>
        Tell us about you
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        One last step before you can start using the app.
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#687076"
        autoCapitalize="words"
        value={fullName}
        onChangeText={setFullName}
      />

      <ThemedText type="defaultSemiBold" style={styles.label}>
        I am a...
      </ThemedText>
      <ThemedView style={styles.roleRow}>
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
            size={22}
            color={role === 'parent' ? '#fff' : '#687076'}
          />
          <ThemedText style={role === 'parent' ? styles.roleTextSelected : undefined}>
            Parent
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.roleOption,
            role === 'nanny' && {
              backgroundColor: RoleColors.nanny,
              borderColor: RoleColors.nanny,
            },
          ]}
          onPress={() => setRole('nanny')}>
          <MaterialIcons
            name="volunteer-activism"
            size={22}
            color={role === 'nanny' ? '#fff' : '#687076'}
          />
          <ThemedText style={role === 'nanny' ? styles.roleTextSelected : undefined}>
            Nanny
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color="#d33" />
          <ThemedText style={styles.error}>{error}</ThemedText>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, (isSubmitting || pressed) && styles.buttonDisabled]}
        disabled={isSubmitting || !fullName.trim() || !role}
        onPress={handleSubmit}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Continue</ThemedText>
        )}
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <ThemedText type="link">Sign out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  label: {
    marginTop: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  error: {
    color: '#d33',
    flexShrink: 1,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
});
