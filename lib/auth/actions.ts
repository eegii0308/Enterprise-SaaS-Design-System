"use server";

import { compare, hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { clearSession, setSession } from "@/lib/auth/session";
import { fixedRoleDescriptions, rolePermissions } from "@/lib/permissions/roles";
import { forgotPasswordSchema, loginSchema, registerSchema } from "@/lib/validations/auth";
import type { RoleName } from "@/types/permissions";

export type AuthFormState = {
  ok: boolean;
  message: string;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

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
    return { ok: false, message: "No active organization membership was found for this account." };
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
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your sign in details." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user || user.status !== "ACTIVE") {
    return { ok: false, message: "Email or password is incorrect." };
  }

  const passwordMatches = await compare(parsed.data.password, user.passwordHash);

  if (!passwordMatches) {
    return { ok: false, message: "Email or password is incorrect." };
  }

  const sessionResult = await createSessionForUser(user.id);

  if (!sessionResult.ok) {
    return sessionResult;
  }

  redirect("/dashboard");
}

export async function registerFirstAdminAction(_state: AuthFormState, formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    fullName: formValue(formData, "fullName"),
    organizationName: formValue(formData, "organizationName"),
    defaultCurrency: formValue(formData, "defaultCurrency") || "MNT",
    fiscalYearStartMonth: formValue(formData, "fiscalYearStartMonth") || "1",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the registration form." };
  }

  const organizationCount = await prisma.organization.count();

  if (organizationCount > 0) {
    return { ok: false, message: "First organization setup is already complete. Ask an Admin to create your membership." };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdUser = await tx.user.create({
      data: {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        passwordHash,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: parsed.data.organizationName,
        defaultCurrency: parsed.data.defaultCurrency,
        fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
      },
    });

    const roles = await Promise.all(
      (Object.keys(rolePermissions) as RoleName[]).map((name) =>
        tx.role.create({
          data: {
            organizationId: organization.id,
            name,
            description: fixedRoleDescriptions[name],
            permissions: {
              create: rolePermissions[name].map((permission) => ({ permission })),
            },
          },
        }),
      ),
    );

    const adminRole = roles.find((role) => role.name === "ADMIN");

    if (!adminRole) {
      throw new Error("Admin role was not created.");
    }

    await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: createdUser.id,
        roleId: adminRole.id,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        actorUserId: createdUser.id,
        action: "organization.created",
        resourceType: "organization",
        resourceId: organization.id,
        metadata: { source: "first_admin_registration" },
      },
    });

    return createdUser;
  });

  const sessionResult = await createSessionForUser(user.id);

  if (!sessionResult.ok) {
    return sessionResult;
  }

  redirect("/dashboard");
}

export async function forgotPasswordAction(_state: AuthFormState, formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({ email: formValue(formData, "email") });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  return { ok: true, message: "If an active account exists, a password reset link will be sent." };
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
