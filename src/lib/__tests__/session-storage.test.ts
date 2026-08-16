import { browserSessionStorage } from '@/lib/session-storage';

describe('browserSessionStorage', () => {
  it('persists sessions through browser localStorage', async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        },
      },
    });

    await browserSessionStorage.setItem('supabase.auth.token', 'session');
    await expect(browserSessionStorage.getItem('supabase.auth.token')).resolves.toBe('session');
    await browserSessionStorage.removeItem('supabase.auth.token');
    await expect(browserSessionStorage.getItem('supabase.auth.token')).resolves.toBeNull();
  });
});
