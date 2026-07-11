import { randomBytes, createHash } from "node:crypto";

// Shared by any feature that hands a user a one-time link (invitations,
// password reset): 256-bit random token, only the SHA-256 hash of which is
// ever persisted. The raw token exists only in the URL sent to the user and
// briefly in server memory during issuance.
export function generateSecureToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecureToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
