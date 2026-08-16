import { z } from 'zod';

export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers, or underscores.'),
  displayName: z.string().trim().max(60, 'Keep it under 60 characters.'),
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});
