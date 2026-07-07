import { fixedRoleDescriptions, rolePermissions } from "../permissions/roles.ts";
import { loginSchema, registerSchema } from "../validations/auth.ts";
import { t } from "../i18n.ts";
import type { RoleName } from "../../types/permissions.ts";

export type AuthFormState = {
  ok: boolean;
  message: string;
};

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  status: string;
};

type AuthRole = {
  id: string;
  name: string;
};

type LoginPrisma = {
  user: {
    findUnique(args: { where: { email: string } }): Promise<AuthUser | null>;
  };
};

type RegisterTransactionClient = {
  user: {
    create(args: { data: { email: string; fullName: string; passwordHash: string } }): Promise<{ id: string }>;
  };
  organization: {
    create(args: {
      data: { name: string; defaultCurrency: string; fiscalYearStartMonth: number };
    }): Promise<{ id: string }>;
  };
  role: {
    create(args: {
      data: {
        organizationId: string;
        name: RoleName;
        description: string;
        permissions: { create: { permission: string }[] };
      };
    }): Promise<AuthRole>;
  };
  membership: {
    create(args: {
      data: {
        organizationId: string;
        userId: string;
        roleId: string;
        status: "ACTIVE";
        joinedAt: Date;
      };
    }): Promise<unknown>;
  };
  auditLog: {
    create(args: {
      data: {
        organizationId: string;
        actorUserId: string;
        action: string;
        resourceType: string;
        resourceId: string;
        metadata: { source: string };
      };
    }): Promise<unknown>;
  };
};

type RegisterPrisma = {
  organization: {
    count(): Promise<number>;
  };
  $transaction<T>(callback: (tx: RegisterTransactionClient) => Promise<T>): Promise<T>;
};

type LoginDependencies = {
  prisma: LoginPrisma;
  comparePassword(password: string, passwordHash: string): Promise<boolean>;
  createSessionForUser(userId: string): Promise<AuthFormState>;
};

type RegisterDependencies = {
  prisma: RegisterPrisma;
  hashPassword(password: string): Promise<string>;
  createSessionForUser(userId: string): Promise<AuthFormState>;
};

export function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function authenticateLogin(formData: FormData, deps: LoginDependencies): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t("auth.messages.checkSignIn") };
  }

  const user = await deps.prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user || user.status !== "ACTIVE") {
    return { ok: false, message: t("auth.messages.invalidCredentials") };
  }

  const passwordMatches = await deps.comparePassword(parsed.data.password, user.passwordHash);

  if (!passwordMatches) {
    return { ok: false, message: t("auth.messages.invalidCredentials") };
  }

  return deps.createSessionForUser(user.id);
}

export async function registerFirstAdmin(formData: FormData, deps: RegisterDependencies): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    fullName: formValue(formData, "fullName"),
    organizationName: formValue(formData, "organizationName"),
    defaultCurrency: formValue(formData, "defaultCurrency") || "MNT",
    fiscalYearStartMonth: formValue(formData, "fiscalYearStartMonth") || "1",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t("auth.messages.checkRegistration") };
  }

  const organizationCount = await deps.prisma.organization.count();

  if (organizationCount > 0) {
    return { ok: false, message: t("auth.messages.firstOrganizationComplete") };
  }

  const passwordHash = await deps.hashPassword(parsed.data.password);

  const user = await deps.prisma.$transaction(async (tx) => {
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
      throw new Error(t("auth.messages.adminRoleMissing"));
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

  return deps.createSessionForUser(user.id);
}
