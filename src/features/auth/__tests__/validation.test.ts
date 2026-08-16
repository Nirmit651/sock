import { signUpSchema } from '@/features/auth/validation';

describe('signUpSchema', () => {
  it('normalizes a valid username and email payload', () => {
    const parsed = signUpSchema.parse({
      username: '  Campus_Legend ',
      displayName: ' Nirmit ',
      email: 'student@example.edu',
      password: 'long-enough',
      dateOfBirth: '2000-01-01',
      legalAgreement: true,
    });
    expect(parsed.username).toBe('campus_legend');
    expect(parsed.displayName).toBe('Nirmit');
  });

  it.each(['ab', 'space cadet', 'no-dashes', 'x'.repeat(25)])(
    'rejects unsafe username %s',
    (username) => {
      expect(
        signUpSchema.safeParse({
          username,
          displayName: '',
          email: 'a@b.edu',
          password: '12345678',
          dateOfBirth: '2000-01-01',
          legalAgreement: true,
        }).success,
      ).toBe(false);
    },
  );

  it('requires a valid email and an 8-character password', () => {
    expect(
      signUpSchema.safeParse({
        username: 'valid_user',
        displayName: '',
        email: 'nope',
        password: 'short',
        dateOfBirth: '2000-01-01',
        legalAgreement: true,
      }).success,
    ).toBe(false);
  });

  it('requires a complete ISO date and affirmative legal acceptance', () => {
    const base = {
      username: 'valid_user', displayName: '', email: 'a@b.edu', password: '12345678',
    };
    expect(signUpSchema.safeParse({ ...base, dateOfBirth: '', legalAgreement: true }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, dateOfBirth: '2000-01-01', legalAgreement: false }).success).toBe(false);
  });
});
