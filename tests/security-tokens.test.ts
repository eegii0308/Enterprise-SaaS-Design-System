import test from "node:test";
import assert from "node:assert/strict";
import { generateSecureToken, hashSecureToken } from "../lib/security/tokens.ts";

// Shared by invitations (lib/invitations/management.ts) and password reset
// (lib/auth/password-reset.ts) -- both hand a user a one-time link and only
// ever persist the hash of the token embedded in it.

test("generateSecureToken produces a high-entropy, URL-safe token", () => {
  const token = generateSecureToken();

  assert.equal(typeof token, "string");
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  // 32 random bytes base64url-encoded is 43 characters (no padding).
  assert.equal(token.length, 43);
});

test("generateSecureToken produces distinct tokens across calls", () => {
  const tokens = new Set(Array.from({ length: 20 }, () => generateSecureToken()));
  assert.equal(tokens.size, 20);
});

test("hashSecureToken is deterministic for the same input", () => {
  const token = generateSecureToken();
  assert.equal(hashSecureToken(token), hashSecureToken(token));
});

test("hashSecureToken produces different hashes for different tokens", () => {
  const tokenA = generateSecureToken();
  const tokenB = generateSecureToken();
  assert.notEqual(hashSecureToken(tokenA), hashSecureToken(tokenB));
});

test("hashSecureToken never returns the raw token", () => {
  const token = generateSecureToken();
  assert.notEqual(hashSecureToken(token), token);
});
