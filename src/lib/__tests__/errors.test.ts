import { friendlyError } from '@/lib/errors';

describe('friendlyError', () => {
  it('does not leak raw database detail for common authorization and duplicate failures', () => {
    expect(friendlyError({ code: '42501', message: 'permission denied for relation device_tokens' })).toBe(
      "You don't have permission to do that.",
    );
    expect(friendlyError({ code: '23505', message: 'duplicate key profiles_username_key' })).toBe(
      'That username is already taken.',
    );
  });

  it('returns a helpful offline message', () => {
    expect(friendlyError({ message: 'Network request failed' })).toContain('No connection');
  });

  it('explains duplicate-email, rate-limit, and expired-code authentication errors', () => {
    expect(friendlyError(new Error('EMAIL_ALREADY_REGISTERED'))).toMatch(/can’t make another account/i);
    expect(friendlyError({ status: 429, message: 'Email rate limit exceeded' })).toMatch(/rate limited/i);
    expect(friendlyError(new Error('Token has expired or is invalid'))).toMatch(/invalid or expired/i);
  });

  it('does not expose an unexpected server message', () => {
    expect(friendlyError({ message: 'relation private.secret_table does not exist' })).toBe(
      'Something went sideways. Try again.',
    );
  });
});
