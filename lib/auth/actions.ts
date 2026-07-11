"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { authenticateLogin, formValue, registerFirstAdmin, type AuthFormState } from "@/lib/auth/core";
export type { AuthFormState } from "@/lib/auth/core";
import { clearSession, createSession } from "@/lib/auth/session";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendEmail } from "@/lib/email/client";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";

async function createSessionForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    include: {
      user: true,
      organization: true,
      role: true,
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (memberships.length !== 1) {
    return { ok: false, message: t("auth.messages.noActiveMembership") };
  }

  const [membership] = memberships;

  if (!membership || membership.role.organizationId !== membership.organizationId) {
    return { ok: false, message: t("auth.messages.noActiveMembership") };
  }

  await createSession(membership.user.id, membership.id);

  return { ok: true, message: "" };
}

export async function loginAction(_state: AuthFormState, formData: FormData) {
  const result = await authenticateLogin(formData, {
    prisma,
    comparePassword: compare,
    createSessionForUser,
  });

  if (!result.ok) {
    return result;
  }

  redirect("/dashboard");
}

export async function registerFirstAdminAction(_state: AuthFormState, formData: FormData) {
  const result = await registerFirstAdmin(formData, {
    prisma,
    hashPassword: (password) => hash(password, 12),
    createSessionForUser,
  });

  if (!result.ok) {
    return result;
  }

  redirect("/dashboard");
}

export async function forgotPasswordAction(_state: AuthFormState, formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({ email: formValue(formData, "email") });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t("auth.messages.validEmail") };
  }

  // The response is identical regardless of what happens below -- whether
  // the email matches a real account, and whether the email actually sends
  // -- so none of this can be allowed to change the message or throw.
  try {
    const result = await requestPasswordReset(parsed.data.email, prisma);

    if (result.sent && process.env.APP_BASE_URL) {
      const { subject, html, text } = buildPasswordResetEmail({
        fullName: result.fullName,
        resetUrl: `${process.env.APP_BASE_URL}/reset-password/${result.token}`,
        expiresAt: result.expiresAt,
      });

      await sendEmail({ to: result.email, subject, html, text }).catch(() => {});
    }
  } catch {
    // Swallowed deliberately -- see comment above.
  }

  return { ok: true, message: t("auth.messages.resetLinkSent") };
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
