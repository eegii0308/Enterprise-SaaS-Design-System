import test from "node:test";
import assert from "node:assert/strict";
import { consume, type RateLimitPrisma } from "../lib/rate-limit/limiter.ts";

type FakeRow = { scope: string; key: string; windowStart: Date; count: number };

// Mirrors Postgres's INSERT ... ON CONFLICT DO UPDATE semantics: reading the
// existing row (if any) and writing the new count happen without yielding to
// the event loop in between, so a call that has already been dispatched
// always completes its read-modify-write before another dispatched call gets
// a turn. The setImmediate before that step simulates real network latency,
// forcing concurrent consume() calls to genuinely interleave -- this would
// expose a bug if consume() were implemented as a separate findUnique
// followed by a create/update, since two such calls could both read "no row"
// before either writes.
function createFakeRateLimitPrisma(): { prisma: RateLimitPrisma; rows: FakeRow[] } {
  const rows: FakeRow[] = [];

  const prisma: RateLimitPrisma = {
    rateLimitAttempt: {
      async upsert({ where, create, update }) {
        await new Promise((resolve) => setImmediate(resolve));

        const { scope, key, windowStart } = where.scope_key_windowStart;
        const existing = rows.find(
          (row) => row.scope === scope && row.key === key && row.windowStart.getTime() === windowStart.getTime(),
        );

        if (existing) {
          existing.count += update.count.increment;
          return { count: existing.count };
        }

        const created: FakeRow = { scope, key, windowStart, count: create.count };
        rows.push(created);
        return { count: created.count };
      },
    },
  };

  return { prisma, rows };
}

test("consume allows the first request in a window and reports remaining", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const result = await consume({ scope: "login:ip", key: "1.2.3.4", windowSeconds: 60, limit: 5 }, prisma);

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("consume allows requests up to the limit, then blocks", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const params = { scope: "login:ip", key: "1.2.3.4", windowSeconds: 60, limit: 3 };

  const first = await consume(params, prisma);
  const second = await consume(params, prisma);
  const third = await consume(params, prisma);
  const fourth = await consume(params, prisma);

  assert.deepEqual(
    [first.allowed, second.allowed, third.allowed, fourth.allowed],
    [true, true, true, false],
  );
  assert.deepEqual([first.remaining, second.remaining, third.remaining], [2, 1, 0]);
  assert.equal(fourth.remaining, 0);
});

test("consume tracks separate counters for different keys in the same scope", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const base = { scope: "login:ip", windowSeconds: 60, limit: 1 };

  const firstKeyFirstCall = await consume({ ...base, key: "1.2.3.4" }, prisma);
  const secondKeyFirstCall = await consume({ ...base, key: "5.6.7.8" }, prisma);

  assert.equal(firstKeyFirstCall.allowed, true);
  assert.equal(secondKeyFirstCall.allowed, true);
});

test("consume tracks separate counters for the same key in different scopes", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const key = "member@example.com";

  const loginScope = await consume({ scope: "login:account", key, windowSeconds: 60, limit: 1 }, prisma);
  const forgotPasswordScope = await consume(
    { scope: "forgot-password:account", key, windowSeconds: 60, limit: 1 },
    prisma,
  );

  assert.equal(loginScope.allowed, true);
  assert.equal(forgotPasswordScope.allowed, true);
});

test("consume returns a stable resetAt for repeated calls within the same window", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const params = { scope: "login:ip", key: "1.2.3.4", windowSeconds: 60, limit: 5 };

  const first = await consume(params, prisma);
  const second = await consume(params, prisma);

  assert.equal(first.resetAt.getTime(), second.resetAt.getTime());
  assert.ok(first.resetAt.getTime() > Date.now());
});

test("consume starts a fresh window once the previous one elapses", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const params = { scope: "login:ip", key: "1.2.3.4", windowSeconds: 1, limit: 1 };

  const first = await consume(params, prisma);
  const blocked = await consume(params, prisma);
  assert.equal(first.allowed, true);
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const afterRollover = await consume(params, prisma);
  assert.equal(afterRollover.allowed, true);
  assert.equal(afterRollover.remaining, 0);
  assert.ok(afterRollover.resetAt.getTime() > blocked.resetAt.getTime());
});

test("consume increments atomically under concurrent access with no lost updates", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const concurrency = 50;

  const results = await Promise.all(
    Array.from({ length: concurrency }, () =>
      consume({ scope: "imports:upload:org", key: "org-1", windowSeconds: 60, limit: 1000 }, prisma),
    ),
  );

  const observedCounts = results.map((result) => 1000 - result.remaining).sort((a, b) => a - b);
  assert.deepEqual(
    observedCounts,
    Array.from({ length: concurrency }, (_, index) => index + 1),
  );
});

test("consume logs a warning only when a request is blocked, never when allowed", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  const params = { scope: "auth:login:ip", key: "1.2.3.4", windowSeconds: 60, limit: 1 };

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };

  let allowedResult: Awaited<ReturnType<typeof consume>>;
  let blockedResult: Awaited<ReturnType<typeof consume>>;

  try {
    allowedResult = await consume(params, prisma);
    assert.equal(calls.length, 0);

    blockedResult = await consume(params, prisma);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(allowedResult.allowed, true);
  assert.equal(blockedResult.allowed, false);
  assert.equal(calls.length, 1);

  const [message] = calls[0] as [string];
  assert.equal(message.includes("1.2.3.4"), false);
});

test("consume rejects a non-positive windowSeconds", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  await assert.rejects(
    () => consume({ scope: "login:ip", key: "1.2.3.4", windowSeconds: 0, limit: 5 }, prisma),
    RangeError,
  );
});

test("consume rejects a non-positive limit", async () => {
  const { prisma } = createFakeRateLimitPrisma();
  await assert.rejects(
    () => consume({ scope: "login:ip", key: "1.2.3.4", windowSeconds: 60, limit: 0 }, prisma),
    RangeError,
  );
});
