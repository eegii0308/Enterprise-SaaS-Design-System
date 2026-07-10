import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptInvitation,
  lookupInvitationByToken,
  InvitationAcceptError,
  type AcceptInvitationPrisma,
  type AcceptInvitationDependencies,
} from "../lib/invitations/accept.ts";
import { hashInvitationToken } from "../lib/security/tokens.ts";

const TOKEN = "test-token-raw-value";
const TOKEN_HASH = hashInvitationToken(TOKEN);

type MockInvitation = {
  id: string;
  organizationId: string;
  email: string;
  roleId: string;
  status: string;
  expiresAt: Date;
  membershipId: string | null;
};

type MockUser = { id: string; email: string; passwordHash: string; status: string };
type MockMembership = { id: string; userId: string; status: string };

type MockState = {
  invitation: MockInvitation | null;
  usersByEmail: Map<string, MockUser>;
  usersById: Map<string, MockUser>;
  membershipsById: Map<string, MockMembership>;
  creates: { users: unknown[]; memberships: unknown[] };
  invitationUpdates: unknown[];
  membershipUpdates: unknown[];
  auditLogs: unknown[];
};

function futureDate(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function pastDate(minutes = 60) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    invitation: null,
    usersByEmail: new Map(),
    usersById: new Map(),
    membershipsById: new Map(),
    creates: { users: [], memberships: [] },
    invitationUpdates: [],
    membershipUpdates: [],
    auditLogs: [],
    ...overrides,
  };
}

function createLookupPrisma(state: MockState): AcceptInvitationPrisma {
  return {
    invitation: {
      async findUnique() {
        if (!state.invitation) {
          return null;
        }

        return {
          ...state.invitation,
          role: { name: "VIEWER" },
          organization: { name: "Acme Reconciliation" },
        };
      },
    },
    async $transaction(callback) {
      throw new Error("not used in lookup tests");
    },
  };
}

function createAcceptDeps(state: MockState): AcceptInvitationDependencies {
  return {
    prisma: {
      async $transaction<T>(callback: (tx: Parameters<AcceptInvitationPrisma["$transaction"]>[0] extends (tx: infer TX) => unknown ? TX : never) => Promise<T>): Promise<T> {
        return callback({
          invitation: {
            async findUnique() {
              return state.invitation;
            },
            async update(args: { where: { id: string }; data: Record<string, unknown> }) {
              state.invitationUpdates.push(args);
              if (state.invitation && state.invitation.id === args.where.id) {
                state.invitation = { ...state.invitation, ...(args.data as Partial<MockInvitation>) };
              }
              return {};
            },
          },
          user: {
            async findUnique(args: { where: { email?: string; id?: string } }) {
              if (args.where.email) {
                return state.usersByEmail.get(args.where.email) ?? null;
              }
              if (args.where.id) {
                return state.usersById.get(args.where.id) ?? null;
              }
              return null;
            },
            async create(args: { data: { email: string; fullName: string; passwordHash: string } }) {
              const id = "new-user-1";
              const user: MockUser = { id, email: args.data.email, passwordHash: args.data.passwordHash, status: "ACTIVE" };
              state.usersByEmail.set(user.email, user);
              state.usersById.set(user.id, user);
              state.creates.users.push(args);
              return { id };
            },
          },
          membership: {
            async findUnique(args: { where: { id: string } }) {
              return state.membershipsById.get(args.where.id) ?? null;
            },
            async update(args: { where: { id: string }; data: Record<string, unknown> }) {
              state.membershipUpdates.push(args);
              const existing = state.membershipsById.get(args.where.id);
              if (existing) {
                state.membershipsById.set(args.where.id, { ...existing, ...(args.data as Partial<MockMembership>) });
              }
              return {};
            },
            async create(args: { data: { userId: string } }) {
              const id = "new-membership-1";
              state.membershipsById.set(id, { id, userId: args.data.userId, status: "ACTIVE" });
              state.creates.memberships.push(args);
              return { id };
            },
          },
          auditLog: {
            async create(args: unknown) {
              state.auditLogs.push(args);
              return {};
            },
          },
        });
      },
    },
    hashPassword: async (password: string) => `hashed:${password}`,
    comparePassword: async (password: string, passwordHash: string) => passwordHash === `hashed:${password}`,
  };
}

test("lookupInvitationByToken returns valid for a pending, unexpired invitation", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: null,
    },
  });

  const result = await lookupInvitationByToken(TOKEN, createLookupPrisma(state));

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.email, "invitee@example.com");
    assert.equal(result.isReactivation, false);
  }
});

test("lookupInvitationByToken returns invalid when no invitation matches", async () => {
  const state = createState({ invitation: null });
  const result = await lookupInvitationByToken(TOKEN, createLookupPrisma(state));
  assert.equal(result.valid, false);
});

test("lookupInvitationByToken returns invalid when the invitation has expired", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: pastDate(),
      membershipId: null,
    },
  });

  const result = await lookupInvitationByToken(TOKEN, createLookupPrisma(state));
  assert.equal(result.valid, false);
});

test("acceptInvitation creates a new user and active membership", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: null,
    },
  });

  const result = await acceptInvitation(
    { token: TOKEN, fullName: "Jane Doe", password: "supersecret" },
    createAcceptDeps(state),
  );

  assert.equal(result.userId, "new-user-1");
  assert.equal(state.creates.users.length, 1);
  assert.equal(state.creates.memberships.length, 1);
  assert.equal(state.invitation?.status, "ACCEPTED");
  assert.equal(state.auditLogs.length, 1);
});

test("acceptInvitation rejects a missing full name for a new account", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: null,
    },
  });

  await assert.rejects(
    () => acceptInvitation({ token: TOKEN, password: "supersecret" }, createAcceptDeps(state)),
    (error: unknown) => error instanceof InvitationAcceptError && error.code === "VALIDATION",
  );
});

test("acceptInvitation rejects when a user already exists for the email", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: null,
    },
  });
  state.usersByEmail.set("invitee@example.com", { id: "user-1", email: "invitee@example.com", passwordHash: "x", status: "ACTIVE" });

  await assert.rejects(
    () => acceptInvitation({ token: TOKEN, fullName: "Jane Doe", password: "supersecret" }, createAcceptDeps(state)),
    (error: unknown) => error instanceof InvitationAcceptError && error.code === "CONFLICT",
  );
});

test("acceptInvitation rejects an expired token", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "invitee@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: pastDate(),
      membershipId: null,
    },
  });

  await assert.rejects(
    () => acceptInvitation({ token: TOKEN, fullName: "Jane Doe", password: "supersecret" }, createAcceptDeps(state)),
    (error: unknown) => error instanceof InvitationAcceptError && error.code === "INVALID_TOKEN",
  );
});

test("acceptInvitation reactivation branch activates the membership on correct password", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "returning@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: "membership-1",
    },
  });
  state.usersById.set("user-1", { id: "user-1", email: "returning@example.com", passwordHash: "hashed:correctpw", status: "ACTIVE" });
  state.membershipsById.set("membership-1", { id: "membership-1", userId: "user-1", status: "INVITED" });

  const result = await acceptInvitation(
    { token: TOKEN, password: "correctpw" },
    createAcceptDeps(state),
  );

  assert.equal(result.userId, "user-1");
  assert.equal(result.membershipId, "membership-1");
  assert.equal(state.membershipsById.get("membership-1")?.status, "ACTIVE");
});

test("acceptInvitation reactivation branch rejects an incorrect password", async () => {
  const state = createState({
    invitation: {
      id: "invitation-1",
      organizationId: "org-1",
      email: "returning@example.com",
      roleId: "role-1",
      status: "PENDING",
      expiresAt: futureDate(),
      membershipId: "membership-1",
    },
  });
  state.usersById.set("user-1", { id: "user-1", email: "returning@example.com", passwordHash: "hashed:correct", status: "ACTIVE" });
  state.membershipsById.set("membership-1", { id: "membership-1", userId: "user-1", status: "INVITED" });

  await assert.rejects(
    () => acceptInvitation({ token: TOKEN, password: "wrong-password" }, createAcceptDeps(state)),
    (error: unknown) => error instanceof InvitationAcceptError && error.code === "INVALID_CREDENTIALS",
  );
});

test("acceptInvitation rejects a password shorter than 8 characters", async () => {
  const state = createState();

  await assert.rejects(
    () => acceptInvitation({ token: TOKEN, fullName: "Jane Doe", password: "short" }, createAcceptDeps(state)),
    (error: unknown) => error instanceof InvitationAcceptError && error.code === "VALIDATION",
  );
});
