import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import type { PasswordRecoverySession } from '@/services/auth';
import { colors, spacing } from '@/theme/tokens';

type ResetStage = 'request' | 'verify' | 'password';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[]; from?: string | string[] }>();
  const initialEmail = useMemo(() => firstParam(params.email) ?? '', [params.email]);
  const fromSettings = firstParam(params.from) === 'settings';
  const { requestPasswordReset, verifyPasswordResetCode, completePasswordReset } = useAuth();
  const [stage, setStage] = useState<ResetStage>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoverySession, setRecoverySession] = useState<PasswordRecoverySession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requestCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the email address for your Sock account.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStage('verify');
      setMessage(`If a Sock account uses ${email.trim()}, we sent a 6-digit reset code. It expires in 10 minutes.`);
    } catch (requestError) {
      setError(friendlyError(requestError, 'Couldn’t send a reset code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const session = await verifyPasswordResetCode(email, code);
      setRecoverySession(session);
      setStage('password');
      setMessage('Code confirmed. Choose a new password for your account.');
    } catch (verificationError) {
      setError(friendlyError(verificationError, 'That reset code could not be verified. Request a new code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (!recoverySession) {
      setStage('request');
      setError('Your reset session ended. Request a new code and try again.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmation) {
      setError('Your new password and confirmation do not match.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await completePasswordReset(recoverySession, password);
      if (fromSettings) {
        router.replace('/(tabs)/profile');
      } else {
        router.replace('/(auth)/login?reset=1');
      }
    } catch (resetError) {
      setError(friendlyError(resetError, 'Couldn’t update your password. Request a new code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (stage === 'verify') {
      setStage('request');
      setError(null);
      setMessage(null);
      return;
    }
    if (stage === 'password') {
      setStage('verify');
      setError(null);
      setMessage(null);
      return;
    }
    router.back();
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.copy}>
        <AppText variant="display">Reset password</AppText>
        <AppText color={colors.muted}>
          {stage === 'request'
            ? 'We’ll email a short-lived code to verify it’s you.'
            : stage === 'verify'
              ? 'Enter the code from your email. It expires 10 minutes after it was sent.'
              : 'Finish by choosing and confirming a new password.'}
        </AppText>
      </View>

      <View style={styles.form}>
        {stage === 'request' ? (
          <TextField
            label="Account email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@school.edu"
            returnKeyType="send"
            onSubmitEditing={requestCode}
          />
        ) : null}
        {stage === 'verify' ? (
          <>
            <TextField
              label="6-digit reset code"
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              returnKeyType="done"
              onSubmitEditing={verifyCode}
            />
            <Button label="Send a new code" tone="quiet" disabled={busy} onPress={requestCode} />
          </>
        ) : null}
        {stage === 'password' ? (
          <>
            <TextField
              label="New password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 8 characters"
              returnKeyType="next"
            />
            <TextField
              label="Confirm new password"
              value={confirmation}
              onChangeText={(value) => {
                setConfirmation(value);
                setError(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Type it again"
              returnKeyType="done"
              onSubmitEditing={savePassword}
            />
          </>
        ) : null}

        {message ? <FormMessage tone="success">{message}</FormMessage> : null}
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button
          label={stage === 'request' ? 'Email reset code' : stage === 'verify' ? 'Verify code' : 'Reset password'}
          loading={busy}
          disabled={stage === 'request' ? !email.trim() : stage === 'verify' ? code.length !== 6 : !password || !confirmation}
          onPress={stage === 'request' ? requestCode : stage === 'verify' ? verifyCode : savePassword}
        />
        <Button label={stage === 'request' ? 'Back' : 'Back'} tone="quiet" disabled={busy} onPress={goBack} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', gap: spacing.xxl, paddingHorizontal: spacing.xl },
  copy: { gap: spacing.sm },
  form: { gap: spacing.lg },
});
