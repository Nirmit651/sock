import { Feather } from '@expo/vector-icons';
import { Link, router, type Href } from 'expo-router';
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
import { colors, font, spacing } from '@/theme/tokens';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [legalAgreement, setLegalAgreement] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalizedDateOfBirth = dateOfBirth.replace(/\D/g, '');
  const dateOfBirthForSignup = normalizedDateOfBirth.length === 8
    ? `${normalizedDateOfBirth.slice(4)}-${normalizedDateOfBirth.slice(0, 2)}-${normalizedDateOfBirth.slice(2, 4)}`
    : '';

  const formatDateOfBirth = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
  };

  const submit = async () => {
    const parsed = signUpSchema.safeParse({
      username,
      displayName,
      email,
      password,
      dateOfBirth: dateOfBirthForSignup,
      legalAgreement,
    });
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
        <TextField
          label="Date of birth"
          value={dateOfBirth}
          onChangeText={(value) => {
            setDateOfBirth(formatDateOfBirth(value));
            setErrors((current) => ({ ...current, dateOfBirth: '' }));
            setSubmitError(null);
          }}
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          error={errors.dateOfBirth}
          placeholder="MM / DD / YYYY"
          maxLength={14}
        />
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
          accessoryRight={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              accessibilityHint="Toggles whether your password is visible"
              hitSlop={8}
              onPress={() => setPasswordVisible((visible) => !visible)}
              style={({ pressed }) => [styles.passwordControl, pressed && styles.pressed]}
            >
              <Feather name={passwordVisible ? 'eye-off' : 'eye'} size={21} color={colors.muted} />
            </Pressable>
          }
        />
        <View style={styles.agreement}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalAgreement }}
            accessibilityLabel="I agree to the Terms of Service and acknowledge the Privacy Policy"
            onPress={() => {
              setLegalAgreement((accepted) => !accepted);
              setErrors((current) => ({ ...current, legalAgreement: '' }));
              setSubmitError(null);
            }}
            style={({ pressed }) => [styles.agreementControl, pressed && styles.pressed]}
          >
            <Feather name={legalAgreement ? 'check-square' : 'square'} size={23} color={legalAgreement ? colors.orange : colors.muted} />
          </Pressable>
          <AppText style={styles.agreementCopy}>
            I agree to the <Link href={'/terms' as Href} style={styles.legalLink}>Terms of Service</Link> and acknowledge the{' '}
            <Link href={'/privacy' as Href} style={styles.legalLink}>Privacy Policy</Link>.
          </AppText>
        </View>
        {errors.legalAgreement ? <FormMessage>{errors.legalAgreement}</FormMessage> : null}
        {submitError ? <FormMessage>{submitError}</FormMessage> : null}
        <Button label="Create account" loading={busy} disabled={!legalAgreement} onPress={submit} />
        <Button label="Back to log in" tone="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginTop: spacing.huge },
  form: { gap: spacing.lg },
  passwordControl: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  agreement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xs },
  agreementControl: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  agreementCopy: { flex: 1, lineHeight: 22 },
  legalLink: { color: colors.orangeDark, textDecorationLine: 'underline', fontFamily: font.semibold },
  pressed: { opacity: 0.65 },
});
