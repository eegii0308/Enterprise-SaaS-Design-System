import { AppError } from "../errors.ts";
import { hasPermission } from "./roles.ts";
import type { SessionUser } from "../auth/session.ts";
import type { Permission, RoleName } from "../../types/permissions.ts";

export async function requireSessionWith(
  getSession: () => Promise<SessionUser | null>,
  redirectToLogin: () => never,
) {
  const session = await getSession();

  if (!session) {
    redirectToLogin();
  }

  return session;
}

export async function requirePermissionWith(
  permission: Permission,
  getSession: () => Promise<SessionUser | null>,
  redirectToLogin: () => never,
) {
  const session = await requireSessionWith(getSession, redirectToLogin);

  if (!hasPermission(session.roleName as RoleName, permission)) {
    throw new AppError("You do not have permission to perform this action.", "FORBIDDEN");
  }

  return session;
}
