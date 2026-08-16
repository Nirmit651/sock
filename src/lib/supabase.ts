import 'react-native-url-polyfill/auto';

import { createClient, processLock } from '@supabase/supabase-js';

import { sessionStorage } from '@/lib/session-storage';
import {
  assertRuntimeConfiguration,
  configuredSupabasePublishableKey,
  configuredSupabaseUrl,
} from '@/lib/runtime';
import type { Database } from '@/types/database';

if (!configuredSupabaseUrl || !configuredSupabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.',
  );
}

assertRuntimeConfiguration(configuredSupabaseUrl);

export const supabase = createClient<Database>(
  configuredSupabaseUrl,
  configuredSupabasePublishableKey,
  {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
  global: {
    headers: { 'x-application-name': 'sock-mobile' },
  },
  },
);
