import { registerPushToken, unregisterCurrentPushToken } from '@/lib/notifications';

const mockGetPermissionsAsync = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/runtime', () => ({ externalServicesEnabled: false }));
jest.mock('@/lib/device-installation', () => ({ getDeviceInstallationId: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: mockGetPermissionsAsync,
  getExpoPushTokenAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

describe('notification isolation in local development', () => {
  it('does not request permissions, contact Expo, or write a token', async () => {
    await expect(registerPushToken('user-1')).resolves.toEqual({ status: 'disabled-local' });
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not call Supabase while unregistering a local-only device', async () => {
    await unregisterCurrentPushToken('user-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
