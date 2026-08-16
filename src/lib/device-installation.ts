import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const INSTALLATION_KEY = 'sock.device-installation-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

export async function getDeviceInstallationId() {
  if (Platform.OS === 'web') return null;
  if (memoryId) return memoryId;

  const stored = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (stored && UUID.test(stored)) {
    memoryId = stored;
    return stored;
  }

  const installationId = crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_KEY, installationId);
  memoryId = installationId;
  return installationId;
}
