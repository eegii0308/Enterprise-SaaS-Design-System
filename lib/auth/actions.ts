"use server";

import { compare, hash } from "bcryptjs";
import { headers } from "next/headers";
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
import { consume } from "@/lib/rate-limit/limiter";
import { getClientIp } from "@/lib/rate-limit/ip";
import { normalizeEmailKey } from "@/lib/rate-limit/keys";
import { rateLimitConfig } from "@/lib/rate-limit/config";

async function isRateLimited(scope: string, key: string, config: { limit: number; windowSeconds: number }) {
  const result = await consume({ scope, key, ...config }, prisma);
  return !result.allowed;
}

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
  const ip = getClientIp(await headers());

  if (await isRateLimited("auth:login:ip", ip, rateLimitConfig.loginIp)) {
    return { ok: false, message: t("auth.messages.tooManyAttempts") };
  }

  const email = normalizeEmailKey(formValue(formData, "email"));

  if (await isRateLimited("auth:login:account", email, rateLimitConfig.loginAccount)) {
    return { ok: false, message: t("auth.messages.tooManyAttempts") };
  }

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
  const ip = getClientIp(await headers());

  if (await isRateLimited("auth:register:ip", ip, rateLimitConfig.registerIp)) {
    return { ok: false, message: t("auth.messages.tooManyAttempts") };
  }

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

  // A rate-limited request must return the exact same response as a normal
  // one -- no email sent, but nothing about the message, shape, or timing
  // may differ -- so this can never become a side channel for confirming
  // that an email is registered (see the identical-response comment below).
  const ip = getClientIp(await headers());
  const email = normalizeEmailKey(parsed.data.email);
  const ipLimited = await isRateLimited("auth:forgot-password:ip", ip, rateLimitConfig.forgotPasswordIp);
  const accountLimited =
    !ipLimited && (await isRateLimited("auth:forgot-password:account", email, rateLimitConfig.forgotPasswordAccount));

  if (ipLimited || accountLimited) {
    return { ok: true, message: t("auth.messages.resetLinkSent") };
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
