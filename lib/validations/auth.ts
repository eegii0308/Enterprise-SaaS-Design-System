import { z } from "zod";
import { t } from "@/lib/i18n";

export const emailSchema = z.string().trim().email().max(255).toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, t("auth.validation.passwordMin")),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, t("auth.validation.fullNameRequired")).max(120),
  organizationName: z.string().trim().min(2, t("auth.validation.organizationRequired")).max(160),
  defaultCurrency: z.string().trim().length(3).toUpperCase().default("MNT"),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
