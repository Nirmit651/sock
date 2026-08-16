import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { signUpSchema } from '@/features/auth/validation';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { colors, spacing } from '@/theme/tokens';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = signUpSchema.safeParse({ username, displayName, email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      setSubmitError('Fix the highlighted fields and try again.');
      return;
    }
    setErrors({});
    setSubmitError(null);
    setBusy(true);
    try {
      const result = await signUp(parsed.data);
      router.replace({
        pathname: '/(auth)/login',
        params: { created: result.requiresEmailConfirmation ? 'confirm' : '1' },
      });
    } catch (error) {
      setSubmitError(friendlyError(error, 'Couldn’t create the account. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display">Claim your sock.</AppText>
        <AppText color={colors.muted}>Private by design. Silly in exactly the right amount.</AppText>
      </View>
      <View style={styles.form}>
        <TextField
          label="Username"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setErrors((current) => ({ ...current, username: '' }));
            setSubmitError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.username}
          placeholder="campus_legend"
        />
        <TextField
          label="Display name (optional)"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: '' }));
            setSubmitError(null);
          }}
          error={errors.displayName}
          placeholder="What friends call you"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: '' }));
            setSubmitError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
          placeholder="you@school.edu"
        />
        <View style={styles.passwordField}>
          <TextField
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: '' }));
              setSubmitError(null);
            }}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            error={errors.password}
            placeholder="At least 8 characters"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordControl, pressed && styles.pressed]}
          >
            <AppText variant="caption" color={colors.orangeDark}>
              {passwordVisible ? 'Hide password' : 'Show password'}
            </AppText>
          </Pressable>
        </View>
        {submitError ? <FormMessage>{submitError}</FormMessage> : null}
        <Button label="Create account" loading={busy} onPress={submit} />
        <Button label="Back to log in" tone="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginTop: spacing.huge },
  form: { gap: spacing.lg },
  passwordField: { gap: spacing.xs },
  passwordControl: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.xs },
  pressed: { opacity: 0.65 },
});
