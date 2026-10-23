import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing, webContentContainer, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';
import { useThemeColors } from '@/hooks/use-theme-color';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError);
    }
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.logoBadge}>
        <MaterialIcons name="family-restroom" size={36} color={c.tint} />
      </View>
      <ThemedText type="title" style={styles.title}>
        Welcome back
      </ThemedText>
      <ThemedText style={styles.subtitle}>Sign in to keep up with the day&apos;s activities.</ThemedText>

      <View style={styles.inputRow}>
        <MaterialIcons name="mail-outline" size={20} color={c.icon} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={styles.inputRow}>
        <MaterialIcons name="lock-outline" size={20} color={c.icon} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={c.textMuted}
          secureTextEntry={!showPassword}
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          onPress={() => setShowPassword((v) => !v)}>
          <MaterialIcons
            name={showPassword ? 'visibility-off' : 'visibility'}
            size={20}
            color={c.icon}
          />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={c.error} />
          <ThemedText style={styles.error}>{error}</ThemedText>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (isSubmitting || pressed) && styles.buttonDisabled,
        ]}
        disabled={isSubmitting || !email || !password}
        onPress={handleSignIn}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Sign in</ThemedText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <ThemedText>Don&apos;t have an account? </ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">Sign up</ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
      ...webContentContainer,
    },
    logoBadge: {
      width: 64,
      height: 64,
      borderRadius: Radii.lg,
      backgroundColor: c.tintSurface,
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
      borderColor: c.inputBorder,
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
      color: c.text,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    error: {
      color: c.error,
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
  });
