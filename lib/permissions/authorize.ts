import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import type { Permission, RoleName } from "@/types/permissions";

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();

  if (!hasPermission(session.roleName as RoleName, permission)) {
    throw new AppError("You do not have permission to perform this action.", "FORBIDDEN");
  }

  return session;
}
