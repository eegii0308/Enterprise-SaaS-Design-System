import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { t } from "@/lib/i18n";

const roleNameSchema = z.enum(["ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AUDITOR", "VIEWER"]);

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleName: roleNameSchema,
});

export const acceptInvitationSchema = z.object({
  fullName: z.string().trim().min(2, t("auth.validation.fullNameRequired")).max(120),
  password: z.string().min(8, t("auth.validation.passwordMin")),
});
