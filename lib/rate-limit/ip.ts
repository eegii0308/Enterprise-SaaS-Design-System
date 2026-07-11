// Matches the subset of the Web Headers API (and next/headers' ReadonlyHeaders,
// which implements it) that this module needs -- kept minimal so callers can
// pass either directly, and so this stays testable without a Next.js request
// context.
export type HeaderLookup = {
  get(name: string): string | null;
};

const UNKNOWN_IP = "unknown";

// Trusts x-forwarded-for / x-real-ip as set by the deployment's edge proxy.
// This is only safe to use as a rate-limit key if that proxy strips any
// client-supplied value for these headers before forwarding -- otherwise a
// client can set its own x-forwarded-for and pick whatever key it likes.
// True by default on Vercel; must be verified for any self-hosted deployment.
export function getClientIp(headers: HeaderLookup): string {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    const trimmed = firstIp?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  const realIp = headers.get("x-real-ip");

  if (realIp?.trim()) {
    return realIp.trim();
  }

  return UNKNOWN_IP;
}
