import test from "node:test";
import assert from "node:assert/strict";
import {
  changeMemberRole,
  disableMember,
  reactivateMember,
  MemberError,
  type MemberDatabase,
} from "../lib/members/management.ts";

const context = { organizationId: "org-1", userId: "admin-1" };

type MockMembership = {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  status: string;
  role: { name: string };
};

type MockState = {
  membership: MockMembership | null;
  role: { id: string; name: string } | null;
  activeAdminCount: number;
  updates: unknown[];
  updateManyCalls: unknown[];
  auditLogs: unknown[];
};

function createDatabase(overrides: Partial<MockState> = {}): MemberDatabase & { state: MockState } {
  const state: MockState = {
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-accountant",
      status: "ACTIVE",
      role: { name: "ACCOUNTANT" },
    },
    role: { id: "role-finance", name: "FINANCE_MANAGER" },
    activeAdminCount: 3,
    updates: [],
    updateManyCalls: [],
    auditLogs: [],
    ...overrides,
  };

  return {
    state,
    async $transaction(callback) {
      return callback({
        membership: {
          async findUnique() {
            return state.membership;
          },
          async update(args) {
            state.updates.push(args);
            return {};
          },
          async updateMany(args) {
            state.updateManyCalls.push(args);
            return { count: 1 };
          },
          async count() {
            return state.activeAdminCount;
          },
        },
        role: {
          async findUnique() {
            return state.role;
          },
        },
        auditLog: {
          async create(args) {
            state.auditLogs.push(args);
            return {};
          },
        },
      });
    },
  };
}

test("changeMemberRole updates the membership's role", async () => {
  const database = createDatabase();

  const result = await changeMemberRole({ membershipId: "membership-1", roleName: "FINANCE_MANAGER" }, context, database);

  assert.equal(result.membershipId, "membership-1");
  assert.equal(database.state.updates.length, 1);
  assert.equal(database.state.auditLogs.length, 1);
});

test("changeMemberRole is a no-op when the role is unchanged", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-finance",
      status: "ACTIVE",
      role: { name: "FINANCE_MANAGER" },
    },
  });

  await changeMemberRole({ membershipId: "membership-1", roleName: "FINANCE_MANAGER" }, context, database);

  assert.equal(database.state.updates.length, 0);
  assert.equal(database.state.auditLogs.length, 0);
});

test("changeMemberRole rejects demoting the last active admin", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-admin",
      status: "ACTIVE",
      role: { name: "ADMIN" },
    },
    activeAdminCount: 1,
  });

  await assert.rejects(
    () => changeMemberRole({ membershipId: "membership-1", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "CONFLICT",
  );
});

test("changeMemberRole allows demoting an admin when another admin remains", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-admin",
      status: "ACTIVE",
      role: { name: "ADMIN" },
    },
    activeAdminCount: 2,
    role: { id: "role-viewer", name: "VIEWER" },
  });

  const result = await changeMemberRole({ membershipId: "membership-1", roleName: "VIEWER" }, context, database);
  assert.equal(result.membershipId, "membership-1");
});

test("changeMemberRole rejects an unknown role name for the organization", async () => {
  const database = createDatabase({ role: null });

  await assert.rejects(
    () => changeMemberRole({ membershipId: "membership-1", roleName: "FINANCE_MANAGER" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "VALIDATION",
  );
});

test("changeMemberRole rejects a non-active membership", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-accountant",
      status: "DISABLED",
      role: { name: "ACCOUNTANT" },
    },
  });

  await assert.rejects(
    () => changeMemberRole({ membershipId: "membership-1", roleName: "FINANCE_MANAGER" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "CONFLICT",
  );
});

test("disableMember disables an active member", async () => {
  const database = createDatabase();

  const result = await disableMember({ membershipId: "membership-1" }, context, database);

  assert.equal(result.status, "DISABLED");
  assert.equal(database.state.updateManyCalls.length, 1);
  assert.equal(database.state.auditLogs.length, 1);
});

test("disableMember rejects disabling your own membership", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "admin-1",
      roleId: "role-admin",
      status: "ACTIVE",
      role: { name: "ADMIN" },
    },
  });

  await assert.rejects(
    () => disableMember({ membershipId: "membership-1" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "VALIDATION",
  );
});

test("disableMember rejects removing the last active admin", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-admin",
      status: "ACTIVE",
      role: { name: "ADMIN" },
    },
    activeAdminCount: 1,
  });

  await assert.rejects(
    () => disableMember({ membershipId: "membership-1" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "CONFLICT",
  );
});

test("disableMember rejects a membership that is already disabled", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-accountant",
      status: "DISABLED",
      role: { name: "ACCOUNTANT" },
    },
  });

  await assert.rejects(
    () => disableMember({ membershipId: "membership-1" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "CONFLICT",
  );
});

test("reactivateMember reactivates a disabled member", async () => {
  const database = createDatabase({
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-accountant",
      status: "DISABLED",
      role: { name: "ACCOUNTANT" },
    },
  });

  const result = await reactivateMember({ membershipId: "membership-1" }, context, database);

  assert.equal(result.status, "ACTIVE");
  assert.equal(database.state.updateManyCalls.length, 1);
});

test("reactivateMember rejects a membership that is already active", async () => {
  const database = createDatabase();

  await assert.rejects(
    () => reactivateMember({ membershipId: "membership-1" }, context, database),
    (error: unknown) => error instanceof MemberError && error.code === "CONFLICT",
  );
});
