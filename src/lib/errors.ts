type ErrorLike = { code?: string; message?: string };

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
  if (message.includes('email send rate limit') || message.includes('only request this after')) {
    return 'Please wait a minute before requesting another confirmation email.';
  }
  if (message.includes('user already registered')) return 'An account already uses that email.';
  if (message.includes('username search limit')) return 'Too many searches. Wait a minute and try again.';
  if (message.includes('password should be')) return 'Use a stronger password and try again.';
  return fallback;
}
