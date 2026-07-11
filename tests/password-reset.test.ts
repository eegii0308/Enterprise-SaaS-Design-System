import test from "node:test";
import assert from "node:assert/strict";
import {
  requestPasswordReset,
  lookupPasswordResetToken,
  resetPassword,
  PasswordResetError,
  type RequestPasswordResetPrisma,
  type LookupPasswordResetPrisma,
  type ResetPasswordDependencies,
} from "../lib/auth/password-reset.ts";
import { hashSecureToken } from "../lib/security/tokens.ts";

type MockUser = { id: string; email: string; fullName: string; status: string };
type MockToken = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };
type MockMembership = { userId: string; organizationId: string; status: string };

type MockState = {
  users: MockUser[];
  tokens: MockToken[];
  memberships: MockMembership[];
  auditLogs: unknown[];
  sessionUpdates: unknown[];
  nextTokenId: number;
};

function futureDate(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function pastDate(minutes = 60) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    users: [{ id: "user-1", email: "member@example.com", fullName: "Member One", status: "ACTIVE" }],
    tokens: [],
    memberships: [{ userId: "user-1", organizationId: "org-1", status: "ACTIVE" }],
    auditLogs: [],
    sessionUpdates: [],
    nextTokenId: 1,
    ...overrides,
  };
}

function createRequestPrisma(state: MockState): RequestPasswordResetPrisma {
  return {
    async $transaction(callback) {
      return callback({
        user: {
          async findUnique(args: { where: { email: string } }) {
            return state.users.find((u) => u.email === args.where.email) ?? null;
          },
        },
        membership: {
          async findFirst(args: { where: { userId: string; status: string } }) {
            const m = state.memberships.find((m) => m.userId === args.where.userId && m.status === args.where.status);
            return m ? { organizationId: m.organizationId } : null;
          },
        },
        passwordResetToken: {
          async updateMany(args: { where: { userId: string; usedAt: null }; data: { usedAt: Date } }) {
            let count = 0;
            for (const t of state.tokens) {
              if (t.userId === args.where.userId && t.usedAt === null) {
                t.usedAt = args.data.usedAt;
                count++;
              }
            }
            return { count };
          },
          async create(args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
            const id = `token-${state.nextTokenId++}`;
            state.tokens.push({ id, userId: args.data.userId, tokenHash: args.data.tokenHash, expiresAt: args.data.expiresAt, usedAt: null });
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
  };
}

function createLookupPrisma(state: MockState): LookupPasswordResetPrisma {
  return {
    passwordResetToken: {
      async findUnique(args: { where: { tokenHash: string } }) {
        const t = state.tokens.find((t) => t.tokenHash === args.where.tokenHash);
        return t ? { expiresAt: t.expiresAt, usedAt: t.usedAt } : null;
      },
    },
  };
}

function createResetDeps(state: MockState): ResetPasswordDependencies {
  return {
    prisma: {
      async $transaction(callback) {
        return callback({
          passwordResetToken: {
            async findUnique(args: { where: { tokenHash: string } }) {
              const t = state.tokens.find((t) => t.tokenHash === args.where.tokenHash);
              return t ? { id: t.id, userId: t.userId, expiresAt: t.expiresAt, usedAt: t.usedAt } : null;
            },
            async update(args: { where: { id: string }; data: { usedAt: Date } }) {
              const t = state.tokens.find((t) => t.id === args.where.id);
              if (t) t.usedAt = args.data.usedAt;
              return {};
            },
            async updateMany(args: { where: { userId: string; usedAt: null; id: { not: string } }; data: { usedAt: Date } }) {
              let count = 0;
              for (const t of state.tokens) {
                if (t.userId === args.where.userId && t.usedAt === null && t.id !== args.where.id.not) {
                  t.usedAt = args.data.usedAt;
                  count++;
                }
              }
              return { count };
            },
          },
          user: {
            async findUnique(args: { where: { id: string } }) {
              const u = state.users.find((u) => u.id === args.where.id);
              return u ? { id: u.id, status: u.status } : null;
            },
            async update(args: { where: { id: string }; data: { passwordHash: string } }) {
              return {};
            },
          },
          membership: {
            async findFirst(args: { where: { userId: string; status: string } }) {
              const m = state.memberships.find((m) => m.userId === args.where.userId && m.status === args.where.status);
              return m ? { organizationId: m.organizationId } : null;
            },
          },
          session: {
            async updateMany(args: unknown) {
              state.sessionUpdates.push(args);
              return { count: 1 };
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
  };
}

// -- requestPasswordReset -----------------------------------------------

test("requestPasswordReset issues a token for a real, active user", async () => {
  const state = createState();
  const result = await requestPasswordReset("member@example.com", createRequestPrisma(state));

  assert.equal(result.sent, true);
  assert.equal(state.tokens.length, 1);
  assert.equal(state.auditLogs.length, 1);
});

test("requestPasswordReset reports not-sent for an email that doesn't exist, without throwing", async () => {
  const state = createState();
  const result = await requestPasswordReset("nobody@example.com", createRequestPrisma(state));

  assert.equal(result.sent, false);
  assert.equal(state.tokens.length, 0);
});

test("requestPasswordReset reports not-sent for a DISABLED user's email", async () => {
  const state = createState({ users: [{ id: "user-1", email: "member@example.com", fullName: "Member One", status: "DISABLED" }] });
  const result = await requestPasswordReset("member@example.com", createRequestPrisma(state));

  assert.equal(result.sent, false);
  assert.equal(state.tokens.length, 0);
});

test("requestPasswordReset normalizes email case before lookup", async () => {
  const state = createState();
  const result = await requestPasswordReset("MEMBER@Example.com", createRequestPrisma(state));
  assert.equal(result.sent, true);
});

test("requestPasswordReset invalidates earlier outstanding tokens for the same user", async () => {
  const state = createState();
  state.tokens.push({ id: "token-old", userId: "user-1", tokenHash: "old-hash", expiresAt: futureDate(), usedAt: null });

  await requestPasswordReset("member@example.com", createRequestPrisma(state));

  const oldToken = state.tokens.find((t) => t.id === "token-old");
  assert.notEqual(oldToken?.usedAt, null);
});

test("requestPasswordReset skips the audit log when the user has no active membership", async () => {
  const state = createState({ memberships: [] });
  await requestPasswordReset("member@example.com", createRequestPrisma(state));
  assert.equal(state.auditLogs.length, 0);
});

// -- lookupPasswordResetToken --------------------------------------------

test("lookupPasswordResetToken is valid for a fresh, unused token", async () => {
  const state = createState();
  const token = "raw-token-1";
  state.tokens.push({ id: "t1", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: null });

  const result = await lookupPasswordResetToken(token, createLookupPrisma(state));
  assert.equal(result.valid, true);
});

test("lookupPasswordResetToken is invalid for an unknown token", async () => {
  const state = createState();
  const result = await lookupPasswordResetToken("unknown", createLookupPrisma(state));
  assert.equal(result.valid, false);
});

test("lookupPasswordResetToken is invalid for an expired token", async () => {
  const state = createState();
  const token = "raw-token-2";
  state.tokens.push({ id: "t2", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: pastDate(), usedAt: null });

  const result = await lookupPasswordResetToken(token, createLookupPrisma(state));
  assert.equal(result.valid, false);
});

test("lookupPasswordResetToken is invalid for an already-used token", async () => {
  const state = createState();
  const token = "raw-token-3";
  state.tokens.push({ id: "t3", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: new Date() });

  const result = await lookupPasswordResetToken(token, createLookupPrisma(state));
  assert.equal(result.valid, false);
});

// -- resetPassword ---------------------------------------------------------

test("resetPassword updates the password, consumes the token, and revokes sessions", async () => {
  const state = createState();
  const token = "raw-token-4";
  state.tokens.push({ id: "t4", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: null });

  const result = await resetPassword({ token, newPassword: "brand-new-password" }, createResetDeps(state));

  assert.equal(result.userId, "user-1");
  assert.notEqual(state.tokens.find((t) => t.id === "t4")?.usedAt, null);
  assert.equal(state.sessionUpdates.length, 1);
  assert.equal(state.auditLogs.length, 1);
});

test("resetPassword rejects a password shorter than 8 characters", async () => {
  const state = createState();
  await assert.rejects(
    () => resetPassword({ token: "irrelevant", newPassword: "short" }, createResetDeps(state)),
    (error: unknown) => error instanceof PasswordResetError && error.code === "VALIDATION",
  );
});

test("resetPassword rejects an unknown token", async () => {
  const state = createState();
  await assert.rejects(
    () => resetPassword({ token: "unknown", newPassword: "brand-new-password" }, createResetDeps(state)),
    (error: unknown) => error instanceof PasswordResetError && error.code === "INVALID_TOKEN",
  );
});

test("resetPassword rejects an expired token", async () => {
  const state = createState();
  const token = "raw-token-5";
  state.tokens.push({ id: "t5", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: pastDate(), usedAt: null });

  await assert.rejects(
    () => resetPassword({ token, newPassword: "brand-new-password" }, createResetDeps(state)),
    (error: unknown) => error instanceof PasswordResetError && error.code === "INVALID_TOKEN",
  );
});

test("resetPassword rejects replay of an already-used token", async () => {
  const state = createState();
  const token = "raw-token-6";
  state.tokens.push({ id: "t6", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: null });

  await resetPassword({ token, newPassword: "first-new-password" }, createResetDeps(state));

  await assert.rejects(
    () => resetPassword({ token, newPassword: "second-new-password" }, createResetDeps(state)),
    (error: unknown) => error instanceof PasswordResetError && error.code === "INVALID_TOKEN",
  );
});

test("resetPassword rejects a token belonging to a no-longer-active user", async () => {
  const state = createState({ users: [{ id: "user-1", email: "member@example.com", fullName: "Member One", status: "DISABLED" }] });
  const token = "raw-token-7";
  state.tokens.push({ id: "t7", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: null });

  await assert.rejects(
    () => resetPassword({ token, newPassword: "brand-new-password" }, createResetDeps(state)),
    (error: unknown) => error instanceof PasswordResetError && error.code === "INVALID_TOKEN",
  );
});

test("resetPassword invalidates sibling outstanding tokens for the same user", async () => {
  const state = createState();
  const usedToken = "raw-token-8";
  const siblingToken = "raw-token-8-sibling";
  state.tokens.push({ id: "t8", userId: "user-1", tokenHash: hashSecureToken(usedToken), expiresAt: futureDate(), usedAt: null });
  state.tokens.push({ id: "t8b", userId: "user-1", tokenHash: hashSecureToken(siblingToken), expiresAt: futureDate(), usedAt: null });

  await resetPassword({ token: usedToken, newPassword: "brand-new-password" }, createResetDeps(state));

  assert.notEqual(state.tokens.find((t) => t.id === "t8b")?.usedAt, null);
});

test("resetPassword skips the audit log when the user has no active membership", async () => {
  const state = createState({ memberships: [] });
  const token = "raw-token-9";
  state.tokens.push({ id: "t9", userId: "user-1", tokenHash: hashSecureToken(token), expiresAt: futureDate(), usedAt: null });

  await resetPassword({ token, newPassword: "brand-new-password" }, createResetDeps(state));
  assert.equal(state.auditLogs.length, 0);
});
