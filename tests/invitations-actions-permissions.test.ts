import test from "node:test";
import assert from "node:assert/strict";
import { createInvitation, type InvitationDatabase } from "../lib/invitations/management.ts";
import { changeMemberRole, type MemberDatabase } from "../lib/members/management.ts";

// These tests exercise the permission gate that app/dashboard/users/actions.ts
// applies in front of lib/invitations/management.ts and lib/members/management.ts,
// without importing actions.ts itself (same pre-existing gap documented in
// tests/bank-accounts-actions-permissions.test.ts: actions.ts pulls in
// requirePermission() from "@/lib/permissions/authorize", which uses the "@/"
// path alias that this repo's plain `node --test` runner cannot resolve).
//
// ROLE_PERMISSIONS mirrors the "users.manage" entries of rolePermissions in
// lib/permissions/roles.ts: only ADMIN holds it.

class SimulatedPermissionError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(role: string, permission: string) {
    super(`Role ${role} lacks permission ${permission}.`);
  }
}

const ROLE_PERMISSIONS = {
  ADMIN: ["users.manage"],
  FINANCE_MANAGER: [],
  ACCOUNTANT: [],
  AUDITOR: [],
  VIEWER: [],
} as const;

type RoleName = keyof typeof ROLE_PERMISSIONS;

function assertPermission(role: RoleName, permission: string) {
  if (!(ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)) {
    throw new SimulatedPermissionError(role, permission);
  }
}

type ActionContext = { organizationId: string; userId: string };

async function simulateInviteMemberAction(role: RoleName, context: ActionContext, database: InvitationDatabase) {
  assertPermission(role, "users.manage");
  return createInvitation({ email: "new@example.com", roleName: "VIEWER" }, context, database);
}

async function simulateChangeMemberRoleAction(role: RoleName, context: ActionContext, database: MemberDatabase) {
  assertPermission(role, "users.manage");
  return changeMemberRole({ membershipId: "membership-1", roleName: "VIEWER" }, context, database);
}

const context: ActionContext = { organizationId: "org-1", userId: "admin-1" };

function createInvitationDatabase(): InvitationDatabase {
  return {
    async $transaction(callback) {
      return callback({
        user: { async findUnique() { return null; } },
        role: { async findUnique() { return { id: "role-viewer", name: "VIEWER" }; } },
        membership: {
          async findUnique() { return null; },
          async update() { return {}; },
        },
        invitation: {
          async findFirst() { return null; },
          async findUnique() { return null; },
          async create() { return { id: "invitation-1" }; },
          async update() { return {}; },
        },
        auditLog: { async create() { return {}; } },
      });
    },
  };
}

function createMemberDatabase(): MemberDatabase {
  return {
    async $transaction(callback) {
      return callback({
        membership: {
          async findUnique() {
            return {
              id: "membership-1",
              organizationId: "org-1",
              userId: "user-1",
              roleId: "role-accountant",
              status: "ACTIVE",
              role: { name: "ACCOUNTANT" },
            };
          },
          async update() { return {}; },
          async updateMany() { return { count: 1 }; },
          async count() { return 3; },
        },
        role: { async findUnique() { return { id: "role-viewer", name: "VIEWER" }; } },
        auditLog: { async create() { return {}; } },
      });
    },
  };
}

for (const role of ["FINANCE_MANAGER", "ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`${role} cannot invite a member`, async () => {
    await assert.rejects(
      () => simulateInviteMemberAction(role, context, createInvitationDatabase()),
      SimulatedPermissionError,
    );
  });

  test(`${role} cannot change a member's role`, async () => {
    await assert.rejects(
      () => simulateChangeMemberRoleAction(role, context, createMemberDatabase()),
      SimulatedPermissionError,
    );
  });
}

test("ADMIN can invite a member", async () => {
  const result = await simulateInviteMemberAction("ADMIN", context, createInvitationDatabase());
  assert.equal(result.email, "new@example.com");
});

test("ADMIN can change a member's role", async () => {
  const result = await simulateChangeMemberRoleAction("ADMIN", context, createMemberDatabase());
  assert.equal(result.membershipId, "membership-1");
});
