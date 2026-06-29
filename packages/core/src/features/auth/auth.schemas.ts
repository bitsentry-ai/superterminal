import { z } from "zod";

export const roleSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().optional(),
});

export const statusSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().optional(),
});

export const userSchema = z.object({
  id: z.union([z.number(), z.string()]),
  email: z.email().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: roleSchema.nullable().optional(),
  status: statusSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
  // 2FA and authentication fields
  totpEnabled: z.boolean().nullable().optional(),
  emailOtpEnabled: z.boolean().nullable().optional(),
  passkeyEnabled: z.boolean().nullable().optional(),
  lastLoginAt: z.date().nullable().optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  firstName: z.string(),
  lastName: z.string(),
});

export const requestPasswordResetSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export const verifyEmailSchema = z.object({
  hash: z.string(),
});

export const confirmNewEmailSchema = z.object({
  token: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  tokenExpires: z.number(),
  user: userSchema,
});

export const refreshResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  tokenExpires: z.number(),
});
