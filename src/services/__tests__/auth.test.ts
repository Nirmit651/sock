import { createClient } from '@supabase/supabase-js';

import { createAccount } from '@/services/auth';

jest.mock('@/lib/runtime', () => ({
  configuredSupabaseUrl: 'https://sock.test',
  configuredSupabasePublishableKey: 'test-publishable-key',
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.Mock;
const mockSignUp = jest.fn();

describe('createAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({ auth: { signUp: mockSignUp } });
  });

  it('creates an auto-confirmed account without persisting its session', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'new-user' }, session: { user: { id: 'new-user' } } },
      error: null,
    });

    await expect(createAccount({
      email: ' NEW@SOCK.TEST ',
      password: 'password123',
      username: ' New_Sock ',
      displayName: ' New Sock ',
    })).resolves.toEqual({ requiresEmailConfirmation: false });

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://sock.test',
      'test-publishable-key',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'NEW@SOCK.TEST',
      password: 'password123',
      options: { data: { username: 'new_sock', display_name: 'New Sock' } },
    });
  });

  it('accepts a confirmation-required account with no session', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'new-user' }, session: null },
      error: null,
    });

    await expect(
      createAccount({
        email: 'new@sock.test',
        password: 'password123',
        username: 'new_sock',
      }),
    ).resolves.toEqual({ requiresEmailConfirmation: true });
  });

  it('returns the Supabase signup error to the form', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('User already registered'),
    });

    await expect(
      createAccount({
        email: 'user@sock.test',
        password: 'password123',
        username: 'user_sock',
      }),
    ).rejects.toThrow('User already registered');
  });
});
