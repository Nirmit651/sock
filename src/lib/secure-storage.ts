import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const webMemory = new Map<string, string>();

function chunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return webMemory.get(key) ?? null;

    const countValue = await SecureStore.getItemAsync(`${key}.chunks`);
    if (!countValue) return null;
    const count = Number.parseInt(countValue, 10);
    if (!Number.isFinite(count) || count < 1 || count > 64) {
      await secureSessionStorage.removeItem(key);
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );
    if (chunks.some((chunk) => chunk === null)) {
      await secureSessionStorage.removeItem(key);
      return null;
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webMemory.set(key, value);
      return;
    }

    await secureSessionStorage.removeItem(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
    );
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      webMemory.delete(key);
      return;
    }

    const countValue = await SecureStore.getItemAsync(`${key}.chunks`);
    const count = Number.parseInt(countValue ?? '0', 10);
    if (Number.isFinite(count) && count > 0 && count <= 64) {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, index)),
        ),
      );
    }
    await SecureStore.deleteItemAsync(`${key}.chunks`);
  },
};
