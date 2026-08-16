const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

// The mock must be declared before this native module consumer is imported.
// eslint-disable-next-line import/first
import { secureSessionStorage } from '@/lib/secure-storage';

describe('secureSessionStorage', () => {
  beforeEach(() => mockStore.clear());

  it('chunks and reconstructs sessions larger than SecureStore item limits', async () => {
    const session = 'x'.repeat(5000);
    await secureSessionStorage.setItem('auth-token', session);
    expect(mockStore.get('auth-token.chunks')).toBe('3');
    await expect(secureSessionStorage.getItem('auth-token')).resolves.toBe(session);
  });

  it('removes every encrypted session chunk on logout', async () => {
    await secureSessionStorage.setItem('auth-token', 'x'.repeat(4000));
    await secureSessionStorage.removeItem('auth-token');
    expect([...mockStore.keys()]).toEqual([]);
  });

  it('fails closed when chunk metadata is invalid', async () => {
    mockStore.set('auth-token.chunks', '999');
    await expect(secureSessionStorage.getItem('auth-token')).resolves.toBeNull();
  });
});
