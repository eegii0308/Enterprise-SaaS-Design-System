import test from "node:test";
import assert from "node:assert/strict";
import {
  requireOrganizationAccessWith,
  requirePermissionWith,
  requireSessionWith,
  type LoadAuthorizationContext,
} from "../lib/permissions/authorize-core.ts";
import { AppError } from "../lib/errors.ts";
import type { SessionUser } from "../lib/auth/session.ts";

const adminSession: SessionUser = {
  userId: "user-1",
  email: "admin@example.com",
  fullName: "Admin User",
  organizationId: "org-1",
  organizationName: "Example LLC",
  membershipId: "membership-1",
  roleId: "role-1",
  roleName: "ADMIN",
};

const loadAdminAuthorization: LoadAuthorizationContext = async () => ({
  organizationId: "org-1",
  permissions: ["users.manage", "settings.manage"],
});

test("requireSessionWith redirects unauthenticated users", async () => {
  const error = new Error("redirect:/login");

  await assert.rejects(
    requireSessionWith(
      async () => null,
      () => {
        throw error;
      },
    ),
    error,
  );
});

test("requireSessionWith returns the active session", async () => {
  const session = await requireSessionWith(
    async () => adminSession,
    () => {
      throw new Error("redirect should not run");
    },
  );

  assert.equal(session.userId, "user-1");
});

test("requirePermissionWith uses loaded permissions instead of session roleName", async () => {
  const allowed = await requirePermissionWith(
    "users.manage",
    async () => ({ ...adminSession, roleName: "VIEWER" }),
    () => {
      throw new Error("redirect should not run");
    },
    loadAdminAuthorization,
  );

  assert.equal(allowed.roleName, "VIEWER");

  await assert.rejects(
    requirePermissionWith(
      "users.manage",
      async () => ({ ...adminSession, roleName: "ADMIN" }),
      () => {
        throw new Error("redirect should not run");
      },
      async () => ({ organizationId: "org-1", permissions: ["reports.view"] }),
    ),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("requirePermissionWith rejects missing authorization context", async () => {
  await assert.rejects(
    requirePermissionWith(
      "users.manage",
      async () => adminSession,
      () => {
        throw new Error("redirect should not run");
      },
      async () => null,
    ),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("requireOrganizationAccessWith enforces the loaded organization", async () => {
  const allowed = await requireOrganizationAccessWith(
    "org-1",
    async () => adminSession,
    () => {
      throw new Error("redirect should not run");
    },
    loadAdminAuthorization,
  );

  assert.equal(allowed.organizationId, "org-1");

  await assert.rejects(
    requireOrganizationAccessWith(
      "org-2",
      async () => adminSession,
      () => {
        throw new Error("redirect should not run");
      },
      loadAdminAuthorization,
    ),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});
