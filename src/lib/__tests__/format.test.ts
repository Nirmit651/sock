import { formatDuration } from '@/lib/format';

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [59, '0m'],
    [60, '1m'],
    [3660, '1h 1m'],
    [-1, '0m'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
