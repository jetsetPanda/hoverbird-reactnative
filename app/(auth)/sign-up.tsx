import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);
    const result = await signUp(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setNeedsEmailConfirmation(true);
    }
    // Otherwise a session was created immediately — the root layout will
    // route to the complete-profile screen automatically.
  }

  if (needsEmailConfirmation) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.logoBadge}>
          <MaterialIcons name="mark-email-read" size={36} color="#0a7ea4" />
        </View>
        <ThemedText type="title" style={styles.title}>
          Check your email
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          We sent a confirmation link to {email}. Confirm it, then sign in.
        </ThemedText>
        <Link href="/sign-in" style={styles.linkButton}>
          <ThemedText type="link">Back to sign in</ThemedText>
        </Link>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.logoBadge}>
        <MaterialIcons name="family-restroom" size={36} color="#0a7ea4" />
      </View>
      <ThemedText type="title" style={styles.title}>
        Create an account
      </ThemedText>
      <ThemedText style={styles.subtitle}>Track activities and milestones together.</ThemedText>

      <View style={styles.inputRow}>
        <MaterialIcons name="mail-outline" size={20} color="#687076" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#687076"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={styles.inputRow}>
        <MaterialIcons name="lock-outline" size={20} color="#687076" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#687076"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color="#d33" />
          <ThemedText style={styles.error}>{error}</ThemedText>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (isSubmitting || pressed) && styles.buttonDisabled,
        ]}
        disabled={isSubmitting || !email || password.length < 6}
        onPress={handleSignUp}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Sign up</ThemedText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <ThemedText>Already have an account? </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">Sign in</ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
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
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
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
    borderRadius: Radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  linkButton: {
    marginTop: Spacing.lg,
    alignSelf: 'center',
  },
});
