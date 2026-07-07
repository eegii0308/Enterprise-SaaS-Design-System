"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { authenticateLogin, formValue, registerFirstAdmin, type AuthFormState } from "@/lib/auth/core";
export type { AuthFormState } from "@/lib/auth/core";
import { clearSession, setSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { forgotPasswordSchema } from "@/lib/validations/auth";

async function createSessionForUser(userId: string) {
  const membership = await prisma.membership.findFirst({
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
  });

  if (!membership) {
    return { ok: false, message: t("auth.messages.noActiveMembership") };
  }

  await setSession({
    userId: membership.user.id,
    email: membership.user.email,
    fullName: membership.user.fullName,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    membershipId: membership.id,
    roleId: membership.role.id,
    roleName: membership.role.name,
  });

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

  return { ok: true, message: t("auth.messages.resetLinkSent") };
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
