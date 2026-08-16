import { isLoopbackUrl, resolveExternalServices } from '@/lib/runtime';

describe('local runtime isolation', () => {
  it('disables external services whenever the local backend is selected', () => {
    expect(resolveExternalServices(true, 'true')).toBe(false);
    expect(resolveExternalServices(true, undefined)).toBe(false);
  });

  it('allows production integrations only when explicitly enabled', () => {
    expect(resolveExternalServices(false, 'true')).toBe(true);
    expect(resolveExternalServices(false, 'false')).toBe(false);
  });

  it('accepts only loopback Supabase URLs for local development', () => {
    expect(isLoopbackUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isLoopbackUrl('http://localhost:54321')).toBe(true);
    expect(isLoopbackUrl('https://example.supabase.co')).toBe(false);
    expect(isLoopbackUrl('not-a-url')).toBe(false);
  });
});
