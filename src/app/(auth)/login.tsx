import { Link, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { created } = useLocalSearchParams<{ created?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setSubmitError('Enter your email and password.');
      return;
    }
    setSubmitError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      setSubmitError(friendlyError(error, 'Couldn’t log in. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Image
          source={require('../../../assets/images/sock-hero.png')}
          contentFit="cover"
          contentPosition="center"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.scrim} />
        <View style={styles.brand}>
          <Image
            source={require('../../../assets/images/sock-app-icon.png')}
            contentFit="contain"
            style={styles.mark}
          />
          <AppText variant="display" color={colors.cream}>Sock</AppText>
          <AppText color="#EADCC8">A little privacy. A lot less explaining.</AppText>
        </View>
      </View>
      <View style={styles.form}>
        {created === 'confirm' ? (
          <FormMessage tone="success">
            Check your email to confirm your account, then log in.
          </FormMessage>
        ) : created === '1' ? (
          <FormMessage tone="success">Account created. Log in to continue.</FormMessage>
        ) : null}
        <TextField
          label="College email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setSubmitError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          placeholder="you@school.edu"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setSubmitError(null);
          }}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={submit}
          placeholder="••••••••"
        />
        {submitError ? <FormMessage>{submitError}</FormMessage> : null}
        <Button label="Log in" loading={busy} disabled={!email.trim() || !password} onPress={submit} />
      </View>
      <View style={styles.footer}>
        <AppText color={colors.muted}>New around here?</AppText>
        <Link href="/(auth)/signup" asChild>
          <Button label="Make an account" tone="quiet" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, gap: spacing.xxl },
  hero: { minHeight: 360, overflow: 'hidden', justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 12, 11, 0.46)',
  },
  brand: { gap: spacing.sm, padding: spacing.xxl, paddingBottom: spacing.huge },
  mark: { width: 58, height: 58, borderRadius: radius.md, marginBottom: spacing.sm },
  form: { gap: spacing.lg, paddingHorizontal: spacing.xl },
  footer: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl },
});
