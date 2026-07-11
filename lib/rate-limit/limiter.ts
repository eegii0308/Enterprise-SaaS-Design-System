import { logRateLimitRejection } from "./log.ts";

export type ConsumeParams = {
  scope: string;
  key: string;
  windowSeconds: number;
  limit: number;
};

export type ConsumeResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type RateLimitAttemptCount = { count: number };

export type RateLimitPrisma = {
  rateLimitAttempt: {
    upsert(args: {
      where: { scope_key_windowStart: { scope: string; key: string; windowStart: Date } };
      create: { scope: string; key: string; windowStart: Date; count: number };
      update: { count: { increment: number } };
      select: { count: true };
    }): Promise<RateLimitAttemptCount>;
  };
};

// Consumes one attempt against a fixed-window counter identified by
// (scope, key, windowStart). Backed by a single upsert -- on Postgres this
// compiles to INSERT ... ON CONFLICT DO UPDATE SET count = count + 1, so the
// increment is read and written by the database in one round trip. Callers
// racing on the same window serialize on that row instead of each doing a
// separate read-then-write that could lose an update; this is what makes the
// counter safe under concurrent requests without any external lock.
export async function consume(params: ConsumeParams, prisma: RateLimitPrisma): Promise<ConsumeResult> {
  const { scope, key, windowSeconds, limit } = params;

  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    throw new RangeError("windowSeconds must be a positive number.");
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new RangeError("limit must be a positive number.");
  }

  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  const record = await prisma.rateLimitAttempt.upsert({
    where: { scope_key_windowStart: { scope, key, windowStart } },
    create: { scope, key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const allowed = record.count <= limit;

  if (!allowed) {
    logRateLimitRejection({ scope, key, count: record.count, limit });
  }

  return {
    allowed,
    remaining: Math.max(0, limit - record.count),
    resetAt,
  };
}
