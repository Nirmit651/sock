import { createClient } from '@supabase/supabase-js';

import {
  configuredSupabasePublishableKey,
  configuredSupabaseUrl,
} from '@/lib/runtime';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type CreateAccountInput = {
  email: string;
  password: string;
  username: string;
  displayName?: string;
};

export type CreateAccountResult = {
  requiresEmailConfirmation: boolean;
};

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
}: CreateAccountInput) {
  if (!configuredSupabaseUrl || !configuredSupabasePublishableKey) {
    throw new Error('Sock Auth is not configured.');
  }

  // Account creation deliberately uses a non-persisting client. When hosted
  // Auth requires email confirmation, Supabase returns a user with no session;
  // that is a successful signup and must not be mistaken for a failure.
  const signupClient = createClient<Database>(
    configuredSupabaseUrl,
    configuredSupabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-application-name': 'sock-account-creation' } },
    },
  );
  const { data, error } = await signupClient.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: username.trim().toLowerCase(),
        display_name: displayName?.trim() || undefined,
      },
    },
  });
  if (error) throw error;
  if (!data.user) {
    throw new Error('Sock did not return an account after signup.');
  }

  return { requiresEmailConfirmation: !data.session };
}
