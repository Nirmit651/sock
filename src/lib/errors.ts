type ErrorLike = { code?: string; message?: string; status?: number };

export function friendlyError(error: unknown, fallback = 'Something went sideways. Try again.') {
  const candidate = (error ?? {}) as ErrorLike;
  const message = candidate.message?.toLowerCase() ?? '';
  if (message.includes('profiles_username_key')) return 'That username is already taken.';
  if (candidate.code === '23505') return 'That already exists.';
  if (candidate.code === '23503') return 'That person or group is no longer available.';
  if (candidate.code === '42501') return "You don't have permission to do that.";
  if (message.includes('network') || message.includes('fetch')) {
    return 'No connection right now. Check your internet and try again.';
  }
  if (message.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Confirm your email before logging in.';
  if (
    candidate.status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('only request this after')
  ) {
    return 'You’re being rate limited. Please wait a few minutes before trying again.';
  }
  if (
    message.includes('email_already_registered') ||
    message.includes('email already registered') ||
    message.includes('user already registered')
  ) {
    return 'You can’t make another account with this email because it is already used for another Sock account. Log in or reset your password instead.';
  }
  if (message.includes('otp_expired') || message.includes('token has expired') || message.includes('token is invalid')) {
    return 'That code is invalid or expired. Request a new code and enter it within 10 minutes.';
  }
  if (message.includes('username search limit')) return 'Too many searches. Wait a minute and try again.';
  if (message.includes('password should be')) return 'Use a stronger password and try again.';
  return fallback;
}
