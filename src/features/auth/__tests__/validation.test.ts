import { signUpSchema } from '@/features/auth/validation';

describe('signUpSchema', () => {
  it('normalizes a valid username and email payload', () => {
    const parsed = signUpSchema.parse({
      username: '  Campus_Legend ',
      displayName: ' Nirmit ',
      email: 'student@example.edu',
      password: 'long-enough',
    });
    expect(parsed.username).toBe('campus_legend');
    expect(parsed.displayName).toBe('Nirmit');
  });

  it.each(['ab', 'space cadet', 'no-dashes', 'x'.repeat(25)])(
    'rejects unsafe username %s',
    (username) => {
      expect(
        signUpSchema.safeParse({ username, displayName: '', email: 'a@b.edu', password: '12345678' }).success,
      ).toBe(false);
    },
  );

  it('requires a valid email and an 8-character password', () => {
    expect(
      signUpSchema.safeParse({ username: 'valid_user', displayName: '', email: 'nope', password: 'short' }).success,
    ).toBe(false);
  });
});
