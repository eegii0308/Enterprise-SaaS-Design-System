import { AppError } from "../errors.ts";
import type { SessionUser } from "../auth/session.ts";
import type { Permission } from "../../types/permissions.ts";

export type AuthorizationContext = {
  organizationId: string;
  permissions: readonly string[];
};

export type LoadAuthorizationContext = (session: SessionUser) => Promise<AuthorizationContext | null>;

function forbidden(): never {
  throw new AppError("You do not have permission to perform this action.", "FORBIDDEN");
}

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
  loadAuthorizationContext: LoadAuthorizationContext,
) {
  const session = await requireSessionWith(getSession, redirectToLogin);
  const authorization = await loadAuthorizationContext(session);

  if (!authorization || !authorization.permissions.includes(permission)) {
    forbidden();
  }

  return session;
}

export async function requireOrganizationAccessWith(
  organizationId: string,
  getSession: () => Promise<SessionUser | null>,
  redirectToLogin: () => never,
  loadAuthorizationContext: LoadAuthorizationContext,
) {
  const session = await requireSessionWith(getSession, redirectToLogin);
  const authorization = await loadAuthorizationContext(session);

  if (!authorization || authorization.organizationId !== organizationId) {
    forbidden();
  }

  return session;
}
