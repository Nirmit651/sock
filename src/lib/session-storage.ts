import { Platform } from 'react-native';

import { secureSessionStorage } from '@/lib/secure-storage';

type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStorage = new Map<string, string>();

// Expo web runs in a browser, where localStorage is the most reliable
// persistence mechanism for Supabase's refresh-token session. The memory
// fallback keeps static export and non-browser tooling safe.
export const browserSessionStorage: SessionStorage = {
  async getItem(key) {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) ?? null;
  },
  async setItem(key, value) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    memoryStorage.set(key, value);
  },
  async removeItem(key) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    memoryStorage.delete(key);
  },
};

export const sessionStorage: SessionStorage =
  Platform.OS === 'web' ? browserSessionStorage : secureSessionStorage;
