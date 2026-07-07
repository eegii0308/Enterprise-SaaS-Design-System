import test from "node:test";
import assert from "node:assert/strict";
import { requirePermissionWith, requireSessionWith } from "../lib/permissions/authorize-core.ts";
import { hasPermission } from "../lib/permissions/roles.ts";
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

test("requirePermissionWith allows granted permissions and rejects missing permissions", async () => {
  const allowed = await requirePermissionWith(
    "users.manage",
    async () => adminSession,
    () => {
      throw new Error("redirect should not run");
    },
  );

  assert.equal(allowed.roleName, "ADMIN");

  await assert.rejects(
    requirePermissionWith(
      "users.manage",
      async () => ({ ...adminSession, roleName: "VIEWER" }),
      () => {
        throw new Error("redirect should not run");
      },
    ),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("fixed role permission checks enforce expected access boundaries", () => {
  assert.equal(hasPermission("ADMIN", "settings.manage"), true);
  assert.equal(hasPermission("FINANCE_MANAGER", "reconciliation.approve"), true);
  assert.equal(hasPermission("ACCOUNTANT", "reconciliation.approve"), false);
  assert.equal(hasPermission("AUDITOR", "transactions.edit"), false);
  assert.equal(hasPermission("VIEWER", "reports.view"), true);
  assert.equal(hasPermission("VIEWER", "reports.export"), false);
});
