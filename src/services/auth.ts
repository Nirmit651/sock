import { createClient, type Session } from '@supabase/supabase-js';

import {
  configuredSupabasePublishableKey,
  configuredSupabaseUrl,
} from '@/lib/runtime';
import { supabase } from '@/lib/supabase';
import { legalDocuments } from '@/content/legal';
import type { Database } from '@/types/database';

type CreateAccountInput = {
  email: string;
  password: string;
  username: string;
  displayName?: string;
  dateOfBirth: string;
  legalAgreement: true;
};

export type CreateAccountResult = {
  requiresEmailConfirmation: boolean;
};

export type PasswordRecoverySession = Pick<Session, 'access_token' | 'refresh_token'>;

function createTransientAuthClient(applicationName: string) {
  if (!configuredSupabaseUrl || !configuredSupabasePublishableKey) {
    throw new Error('Sock Auth is not configured.');
  }

  return createClient<Database>(
    configuredSupabaseUrl,
    configuredSupabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-application-name': applicationName } },
    },
  );
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  });
  if (error) throw error;
}

export async function createAccount({
  email,
  password,
  username,
  displayName,
  dateOfBirth,
  legalAgreement,
}: CreateAccountInput) {
  // Account creation deliberately uses a non-persisting client. When hosted
  // Auth requires email confirmation, Supabase returns a user with no session;
  // that is a successful signup and must not be mistaken for a failure.
  const signupClient = createTransientAuthClient('sock-account-creation');
  const { data, error } = await signupClient.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: username.trim().toLowerCase(),
        display_name: displayName?.trim() || undefined,
        date_of_birth: dateOfBirth,
        legal_agreement: legalAgreement,
        terms_version: legalDocuments.termsVersion,
        privacy_policy_version: legalDocuments.privacyPolicyVersion,
      },
    },
  });
  if (error) throw error;
  if (!data.user) {
    throw new Error('Sock did not return an account after signup.');
  }
  // Hosted Supabase deliberately returns an obfuscated user instead of an
  // error when confirmations are enabled and an address already exists.
  if (!data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('EMAIL_ALREADY_REGISTERED');
  }

  return { requiresEmailConfirmation: !data.session };
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean }>('delete-account', {
    body: {},
  });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Sock could not confirm that the account was deleted.');
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<PasswordRecoverySession> {
  const recoveryClient = createTransientAuthClient('sock-password-recovery');
  const { data, error } = await recoveryClient.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'recovery',
  });
  if (error) throw error;
  if (!data.session) throw new Error('The reset code did not create a recovery session. Request a new code and try again.');

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

export async function completePasswordReset(
  recoverySession: PasswordRecoverySession,
  password: string,
) {
  const recoveryClient = createTransientAuthClient('sock-password-update');
  const { error: sessionError } = await recoveryClient.auth.setSession(recoverySession);
  if (sessionError) throw sessionError;

  const { error } = await recoveryClient.auth.updateUser({ password });
  if (error) throw error;
}
