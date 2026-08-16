import Constants from 'expo-constants';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);

type SockRuntimeConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  localBackend?: boolean;
  externalServicesEnabled?: boolean;
};

const runtimeConfig = Constants.expoConfig?.extra?.sock as SockRuntimeConfig | undefined;

export function resolveExternalServices(localBackend: boolean, externalSetting?: string) {
  return externalSetting !== 'false' && !localBackend;
}

export function isLoopbackUrl(value: string) {
  try {
    return loopbackHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const configuredSupabaseUrl =
  runtimeConfig?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;

export const configuredSupabasePublishableKey =
  runtimeConfig?.supabasePublishableKey ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isLocalBackend =
  runtimeConfig?.localBackend === true ||
  process.env.EXPO_PUBLIC_LOCAL_BACKEND === 'true' ||
  (Boolean(configuredSupabaseUrl) && isLoopbackUrl(configuredSupabaseUrl!));

export const externalServicesEnabled = resolveExternalServices(
  isLocalBackend,
  typeof runtimeConfig?.externalServicesEnabled === 'boolean'
    ? String(runtimeConfig.externalServicesEnabled)
    : process.env.EXPO_PUBLIC_EXTERNAL_SERVICES_ENABLED,
);

export function assertRuntimeConfiguration(supabaseUrl: string) {
  if (isLocalBackend && !isLoopbackUrl(supabaseUrl)) {
    throw new Error('Local development can only connect to a loopback Supabase backend.');
  }
}
