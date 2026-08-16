import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDeviceInstallationId } from '@/lib/device-installation';
import { externalServicesEnabled } from '@/lib/runtime';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(userId: string) {
  if (!externalServicesEnabled) return { status: 'disabled-local' as const };
  if (!Device.isDevice || Platform.OS === 'web') return { status: 'unavailable' as const };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sock-status', {
      name: 'Sock status',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: '#F0643B',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { status: 'denied' as const };

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return { status: 'missing-project-id' as const };

  const installationId = await getDeviceInstallationId();
  if (!installationId) return { status: 'unavailable' as const };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: userId,
      installation_id: installationId,
      expo_push_token: token,
      platform: Platform.OS as 'ios' | 'android',
    },
    { onConflict: 'user_id,installation_id' },
  );
  if (error) throw error;
  return { status: 'registered' as const };
}

export async function unregisterCurrentPushToken(userId: string) {
  if (!externalServicesEnabled) return;
  const installationId = await getDeviceInstallationId();
  if (!installationId) return;

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('installation_id', installationId);
  if (error) throw error;
}
