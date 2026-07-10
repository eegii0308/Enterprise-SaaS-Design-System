import test from "node:test";
import assert from "node:assert/strict";
import {
  createInvitation,
  cancelInvitation,
  resendInvitation,
  InvitationError,
  type InvitationDatabase,
} from "../lib/invitations/management.ts";

const context = { organizationId: "org-1", userId: "admin-1" };

type MockRole = { id: string; name: string };
type MockMembership = { id: string; status: string };
type MockInvitation = {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  membershipId: string | null;
  roleId?: string;
  updatedAt: Date;
};

type MockState = {
  role: MockRole | null;
  existingUserId: string | null;
  existingMembership: MockMembership | null;
  pendingInvitation: MockInvitation | null;
  invitationsById: Map<string, MockInvitation>;
  creates: unknown[];
  membershipUpdates: unknown[];
  auditLogs: unknown[];
};

function createDatabase(overrides: Partial<MockState> = {}): InvitationDatabase & { state: MockState } {
  const state: MockState = {
    role: { id: "role-viewer", name: "VIEWER" },
    existingUserId: null,
    existingMembership: null,
    pendingInvitation: null,
    invitationsById: new Map(),
    creates: [],
    membershipUpdates: [],
    auditLogs: [],
    ...overrides,
  };

  return {
    state,
    async $transaction(callback) {
      return callback({
        user: {
          async findUnique() {
            return state.existingUserId ? { id: state.existingUserId } : null;
          },
        },
        role: {
          async findUnique() {
            return state.role;
          },
        },
        membership: {
          async findUnique() {
            return state.existingMembership;
          },
          async update(args) {
            state.membershipUpdates.push(args);
            return {};
          },
        },
        invitation: {
          async findFirst() {
            return state.pendingInvitation;
          },
          async findUnique(args: { where: { id: string } }) {
            return state.invitationsById.get(args.where.id) ?? null;
          },
          async create(args: { data: Record<string, unknown> }) {
            state.creates.push(args);
            const id = "invitation-new";
            state.invitationsById.set(id, {
              id,
              organizationId: args.data.organizationId as string,
              email: args.data.email as string,
              status: args.data.status as string,
              membershipId: (args.data.membershipId as string | null) ?? null,
              roleId: args.data.roleId as string,
              updatedAt: new Date(),
            });
            return { id };
          },
          async update(args: { where: { id: string }; data: Record<string, unknown> }) {
            const existing = state.invitationsById.get(args.where.id);
            if (existing) {
              state.invitationsById.set(args.where.id, { ...existing, ...args.data } as MockInvitation);
            }
            return {};
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

test("createInvitation creates a pending invitation for a brand-new email", async () => {
  const database = createDatabase();

  const result = await createInvitation({ email: "New.User@example.com", roleName: "VIEWER" }, context, database);

  assert.equal(result.email, "new.user@example.com");
  assert.equal(database.state.creates.length, 1);
  assert.equal(database.state.membershipUpdates.length, 0);
  assert.equal(database.state.auditLogs.length, 1);
  assert.equal((database.state.auditLogs[0] as { data: { action: string } }).data.action, "INVITATION_SENT");
});

test("createInvitation rejects when the role does not exist for the organization", async () => {
  const database = createDatabase({ role: null });

  await assert.rejects(
    () => createInvitation({ email: "new@example.com", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "VALIDATION",
  );
});

test("createInvitation rejects an email already registered in a different organization", async () => {
  const database = createDatabase({ existingUserId: "user-1", existingMembership: null });

  await assert.rejects(
    () => createInvitation({ email: "elsewhere@example.com", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("createInvitation rejects an email that is already an active member", async () => {
  const database = createDatabase({
    existingUserId: "user-1",
    existingMembership: { id: "membership-1", status: "ACTIVE" },
  });

  await assert.rejects(
    () => createInvitation({ email: "member@example.com", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("createInvitation rejects an email with an already-pending invitation to this org", async () => {
  const database = createDatabase({
    existingUserId: "user-1",
    existingMembership: { id: "membership-1", status: "INVITED" },
  });

  await assert.rejects(
    () => createInvitation({ email: "invited@example.com", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("createInvitation rejects a duplicate pending invite for a brand-new email", async () => {
  const database = createDatabase({
    pendingInvitation: {
      id: "invitation-existing",
      organizationId: "org-1",
      email: "new@example.com",
      status: "PENDING",
      membershipId: null,
      updatedAt: new Date(),
    },
  });

  await assert.rejects(
    () => createInvitation({ email: "new@example.com", roleName: "VIEWER" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("createInvitation reactivates a DISABLED membership in the same organization", async () => {
  const database = createDatabase({
    existingUserId: "user-1",
    existingMembership: { id: "membership-1", status: "DISABLED" },
  });

  const result = await createInvitation({ email: "returning@example.com", roleName: "ADMIN" }, context, database);

  assert.equal(database.state.membershipUpdates.length, 1);
  assert.equal(
    (database.state.membershipUpdates[0] as { data: { status: string } }).data.status,
    "INVITED",
  );
  assert.equal(result.email, "returning@example.com");
});

test("cancelInvitation revokes a pending invitation", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "cancel-me@example.com",
    status: "PENDING",
    membershipId: null,
    updatedAt: new Date(),
  });

  await cancelInvitation({ invitationId: "invitation-1" }, context, database);

  const updated = database.state.invitationsById.get("invitation-1");
  assert.equal(updated?.status, "REVOKED");
  assert.equal(database.state.auditLogs.length, 1);
});

test("cancelInvitation reverts a reactivation membership back to DISABLED", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "cancel-me@example.com",
    status: "PENDING",
    membershipId: "membership-1",
    updatedAt: new Date(),
  });

  await cancelInvitation({ invitationId: "invitation-1" }, context, database);

  assert.equal(database.state.membershipUpdates.length, 1);
  assert.equal(
    (database.state.membershipUpdates[0] as { data: { status: string } }).data.status,
    "DISABLED",
  );
});

test("cancelInvitation rejects a non-pending invitation", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "already@example.com",
    status: "ACCEPTED",
    membershipId: null,
    updatedAt: new Date(),
  });

  await assert.rejects(
    () => cancelInvitation({ invitationId: "invitation-1" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("cancelInvitation rejects an invitation from a different organization", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-2",
    email: "foreign@example.com",
    status: "PENDING",
    membershipId: null,
    updatedAt: new Date(),
  });

  await assert.rejects(
    () => cancelInvitation({ invitationId: "invitation-1" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "FORBIDDEN",
  );
});

test("resendInvitation rotates the token when outside the cooldown window", async () => {
  const database = createDatabase({ role: { id: "role-viewer", name: "VIEWER" } });
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "resend-me@example.com",
    status: "PENDING",
    membershipId: null,
    roleId: "role-viewer",
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
  });

  const result = await resendInvitation({ invitationId: "invitation-1" }, context, database);

  assert.equal(result.email, "resend-me@example.com");
  assert.equal(result.roleName, "VIEWER");
});

test("resendInvitation rejects when within the cooldown window", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "too-soon@example.com",
    status: "PENDING",
    membershipId: null,
    roleId: "role-viewer",
    updatedAt: new Date(),
  });

  await assert.rejects(
    () => resendInvitation({ invitationId: "invitation-1" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});

test("resendInvitation rejects a non-pending invitation", async () => {
  const database = createDatabase();
  database.state.invitationsById.set("invitation-1", {
    id: "invitation-1",
    organizationId: "org-1",
    email: "gone@example.com",
    status: "REVOKED",
    membershipId: null,
    roleId: "role-viewer",
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
  });

  await assert.rejects(
    () => resendInvitation({ invitationId: "invitation-1" }, context, database),
    (error: unknown) => error instanceof InvitationError && error.code === "CONFLICT",
  );
});
