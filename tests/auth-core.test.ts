import test from "node:test";
import assert from "node:assert/strict";
import { authenticateLogin, registerFirstAdmin } from "../lib/auth/core.ts";

function form(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

test("registerFirstAdmin creates the first tenant, roles, admin membership, audit log, and session", async () => {
  const createdRoles: unknown[] = [];
  const memberships: unknown[] = [];
  const auditLogs: unknown[] = [];
  let sessionUserId = "";

  const tx = {
    user: {
      async create(args: { data: unknown }) {
        assert.deepEqual(args.data, {
          email: "admin@example.com",
          fullName: "Admin User",
          passwordHash: "hashed-password",
        });
        return { id: "user-1" };
      },
    },
    organization: {
      async create(args: { data: unknown }) {
        assert.deepEqual(args.data, {
          name: "Example LLC",
          defaultCurrency: "MNT",
          fiscalYearStartMonth: 1,
        });
        return { id: "org-1" };
      },
    },
    role: {
      async create(args: { data: { name: string } }) {
        createdRoles.push(args.data);
        return { id: `role-${args.data.name}`, name: args.data.name };
      },
    },
    membership: {
      async create(args: { data: unknown }) {
        memberships.push(args.data);
        return args.data;
      },
    },
    auditLog: {
      async create(args: { data: unknown }) {
        auditLogs.push(args.data);
        return args.data;
      },
    },
  };

  const prisma = {
    organization: { async count() { return 0; } },
    async $transaction<T>(callback: (txClient: typeof tx) => Promise<T>) {
      return callback(tx);
    },
  };

  const result = await registerFirstAdmin(
    form({
      email: " ADMIN@Example.com ",
      password: "correct horse battery staple",
      fullName: "Admin User",
      organizationName: "Example LLC",
    }),
    {
      prisma,
      async hashPassword(password) {
        assert.equal(password, "correct horse battery staple");
        return "hashed-password";
      },
      async createSessionForUser(userId) {
        sessionUserId = userId;
        return { ok: true, message: "" };
      },
    },
  );

  assert.deepEqual(result, { ok: true, message: "" });
  assert.equal(createdRoles.length, 5);
  assert.equal(createdRoles.some((role) => (role as { name: string }).name === "ADMIN"), true);
  assert.equal((memberships[0] as { roleId: string }).roleId, "role-ADMIN");
  assert.equal((auditLogs[0] as { action: string }).action, "organization.created");
  assert.equal(sessionUserId, "user-1");
});

test("registerFirstAdmin rejects setup after the first organization exists", async () => {
  const result = await registerFirstAdmin(
    form({
      email: "admin@example.com",
      password: "correct horse battery staple",
      fullName: "Admin User",
      organizationName: "Example LLC",
    }),
    {
      prisma: {
        organization: { async count() { return 1; } },
        async $transaction() {
          throw new Error("transaction should not run");
        },
      },
      async hashPassword() {
        throw new Error("hash should not run");
      },
      async createSessionForUser() {
        throw new Error("session should not be created");
      },
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /already complete/);
});

test("authenticateLogin validates email and password before querying users", async () => {
  let queried = false;

  const result = await authenticateLogin(form({ email: "not-an-email", password: "short" }), {
    prisma: {
      user: {
        async findUnique() {
          queried = true;
          return null;
        },
      },
    },
    async comparePassword() {
      throw new Error("compare should not run");
    },
    async createSessionForUser() {
      throw new Error("session should not be created");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(queried, false);
});

test("authenticateLogin rejects inactive users and invalid passwords without exposing which check failed", async () => {
  const inactive = await authenticateLogin(form({ email: "user@example.com", password: "password123" }), {
    prisma: {
      user: { async findUnique() { return { id: "user-1", email: "user@example.com", fullName: "User", passwordHash: "hash", status: "INACTIVE" }; } },
    },
    async comparePassword() {
      throw new Error("compare should not run for inactive users");
    },
    async createSessionForUser() {
      throw new Error("session should not be created");
    },
  });

  const badPassword = await authenticateLogin(form({ email: "user@example.com", password: "password123" }), {
    prisma: {
      user: { async findUnique() { return { id: "user-1", email: "user@example.com", fullName: "User", passwordHash: "hash", status: "ACTIVE" }; } },
    },
    async comparePassword() {
      return false;
    },
    async createSessionForUser() {
      throw new Error("session should not be created");
    },
  });

  assert.deepEqual(inactive, { ok: false, message: "Email or password is incorrect." });
  assert.deepEqual(badPassword, { ok: false, message: "Email or password is incorrect." });
});

test("authenticateLogin creates a session for active users with valid credentials", async () => {
  let comparedPassword = "";
  let sessionUserId = "";

  const result = await authenticateLogin(form({ email: "USER@EXAMPLE.COM", password: "password123" }), {
    prisma: {
      user: {
        async findUnique(args: { where: { email: string } }) {
          assert.equal(args.where.email, "user@example.com");
          return { id: "user-1", email: "user@example.com", fullName: "User", passwordHash: "hash", status: "ACTIVE" };
        },
      },
    },
    async comparePassword(password) {
      comparedPassword = password;
      return true;
    },
    async createSessionForUser(userId) {
      sessionUserId = userId;
      return { ok: true, message: "" };
    },
  });

  assert.equal(comparedPassword, "password123");
  assert.equal(sessionUserId, "user-1");
  assert.deepEqual(result, { ok: true, message: "" });
});
