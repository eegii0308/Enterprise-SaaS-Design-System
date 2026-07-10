import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  requireOrganizationAccessWith,
  requirePermissionWith,
  requireSessionWith,
  type AuthorizationContext,
} from "@/lib/permissions/authorize-core";
import type { SessionUser } from "@/lib/auth/session";
import type { Permission } from "@/types/permissions";

function redirectToLogin(): never {
  redirect("/login");
}

async function loadAuthorizationContext(session: SessionUser): Promise<AuthorizationContext | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: session.membershipId,
      userId: session.userId,
      organizationId: session.organizationId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership || membership.role.organizationId !== membership.organizationId) {
    return null;
  }

  return {
    organizationId: membership.organizationId,
    permissions: membership.role.permissions.map((permission) => permission.permission),
  };
}

export async function requireSession() {
  return requireSessionWith(getSession, redirectToLogin);
}

export async function requirePermission(permission: Permission) {
  return requirePermissionWith(permission, getSession, redirectToLogin, loadAuthorizationContext);
}

export async function hasPermission(permission: Permission) {
  const session = await getSession();

  if (!session) {
    return false;
  }

  const authorization = await loadAuthorizationContext(session);
  return authorization?.permissions.includes(permission) ?? false;
}

export async function requireOrganizationAccess(organizationId: string) {
  return requireOrganizationAccessWith(organizationId, getSession, redirectToLogin, loadAuthorizationContext);
}
