import { createHash } from "node:crypto";

// Deterministic but non-reversible: lets repeated rejections from the same
// key (an IP, email, user id, or org id) be correlated across log lines
// without ever printing the raw value. Applied uniformly regardless of what
// the key represents, so a caller can never leak a sensitive identifier --
// or, in some future misuse, a password -- into logs just by passing it as
// `key`.
export function safeIdentifier(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

export type RateLimitRejection = {
  scope: string;
  key: string;
  count: number;
  limit: number;
};

// Fires only for rejections -- allowed requests are the overwhelming
// majority of traffic and carry no security signal worth logging.
export function logRateLimitRejection({ scope, key, count, limit }: RateLimitRejection): void {
  console.warn(`[rate-limit] blocked scope=${scope} key=${safeIdentifier(key)} count=${count} limit=${limit}`);
}
