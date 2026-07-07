import { z } from "zod";

export const emailSchema = z.string().trim().email().max(255).toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  organizationName: z.string().trim().min(2, "Enter your organization name.").max(160),
  defaultCurrency: z.string().trim().length(3).toUpperCase().default("MNT"),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
