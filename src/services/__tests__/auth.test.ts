import { createClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  completePasswordReset,
  createAccount,
  deleteCurrentAccount,
  requestPasswordReset,
  resendSignupConfirmation,
  verifyPasswordResetCode,
} from '@/services/auth';

jest.mock('@/lib/runtime', () => ({
  configuredSupabaseUrl: 'https://sock.test',
  configuredSupabasePublishableKey: 'test-publishable-key',
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { resend: jest.fn(), resetPasswordForEmail: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

const mockCreateClient = createClient as jest.Mock;
const mockSignUp = jest.fn();
const mockResend = supabase.auth.resend as jest.Mock;
const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;
const mockInvokeFunction = supabase.functions.invoke as jest.Mock;

describe('createAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({ auth: { signUp: mockSignUp } });
    mockResend.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockInvokeFunction.mockResolvedValue({ data: { deleted: true }, error: null });
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
      dateOfBirth: '2000-01-01',
      legalAgreement: true,
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
      options: {
        data: {
          username: 'new_sock',
          display_name: 'New Sock',
          date_of_birth: '2000-01-01',
          legal_agreement: true,
          terms_version: '2026-08-16',
          privacy_policy_version: '2026-08-16',
        },
      },
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
        dateOfBirth: '2000-01-01',
        legalAgreement: true,
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
        dateOfBirth: '2000-01-01',
        legalAgreement: true,
      }),
    ).rejects.toThrow('User already registered');
  });

  it('identifies Supabase’s obfuscated existing-account signup response', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'obfuscated', identities: [] }, session: null },
      error: null,
    });

    await expect(
      createAccount({
        email: 'user@sock.test',
        password: 'password123',
        username: 'user_sock',
        dateOfBirth: '2000-01-01',
        legalAgreement: true,
      }),
    ).rejects.toThrow('EMAIL_ALREADY_REGISTERED');
  });

  it('resends a confirmation link without creating another account', async () => {
    await expect(resendSignupConfirmation(' NEW@SOCK.TEST ')).resolves.toBeUndefined();
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'NEW@SOCK.TEST' });
  });

  it('requests a password recovery email', async () => {
    await expect(requestPasswordReset(' RESET@SOCK.TEST ')).resolves.toBeUndefined();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('RESET@SOCK.TEST');
  });

  it('requests deletion only through the protected account endpoint', async () => {
    await expect(deleteCurrentAccount()).resolves.toBeUndefined();
    expect(mockInvokeFunction).toHaveBeenCalledWith('delete-account', { body: {} });
  });

  it('verifies a recovery code and updates the password with its temporary session', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({
      data: { session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    });
    const setSession = jest.fn().mockResolvedValue({ error: null });
    const updateUser = jest.fn().mockResolvedValue({ error: null });
    mockCreateClient
      .mockReturnValueOnce({ auth: { verifyOtp } })
      .mockReturnValueOnce({ auth: { setSession, updateUser } });

    const session = await verifyPasswordResetCode(' reset@sock.test ', ' 123456 ');
    await completePasswordReset(session, 'fresh-password');

    expect(verifyOtp).toHaveBeenCalledWith({ email: 'reset@sock.test', token: '123456', type: 'recovery' });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'fresh-password' });
  });
});
