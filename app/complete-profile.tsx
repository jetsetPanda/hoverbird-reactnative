import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth, type UserRole } from '@/contexts/auth-provider';

export default function CompleteProfileScreen() {
  const { completeProfile, signOut } = useAuth();
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
    <ThemedView style={styles.container}>
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
          style={[styles.roleOption, role === 'parent' && styles.roleOptionSelected]}
          onPress={() => setRole('parent')}>
          <ThemedText style={role === 'parent' ? styles.roleTextSelected : undefined}>
            Parent
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.roleOption, role === 'nanny' && styles.roleOptionSelected]}
          onPress={() => setRole('nanny')}>
          <ThemedText style={role === 'nanny' ? styles.roleTextSelected : undefined}>
            Nanny
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
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
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  roleTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#d33',
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
