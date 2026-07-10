import test from "node:test";
import assert from "node:assert/strict";
import { generateInvitationToken, hashInvitationToken } from "../lib/security/tokens.ts";

test("generateInvitationToken produces a high-entropy, URL-safe token", () => {
  const token = generateInvitationToken();

  assert.equal(typeof token, "string");
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  // 32 random bytes base64url-encoded is 43 characters (no padding).
  assert.equal(token.length, 43);
});

test("generateInvitationToken produces distinct tokens across calls", () => {
  const tokens = new Set(Array.from({ length: 20 }, () => generateInvitationToken()));
  assert.equal(tokens.size, 20);
});

test("hashInvitationToken is deterministic for the same input", () => {
  const token = generateInvitationToken();
  assert.equal(hashInvitationToken(token), hashInvitationToken(token));
});

test("hashInvitationToken produces different hashes for different tokens", () => {
  const tokenA = generateInvitationToken();
  const tokenB = generateInvitationToken();
  assert.notEqual(hashInvitationToken(tokenA), hashInvitationToken(tokenB));
});

test("hashInvitationToken never returns the raw token", () => {
  const token = generateInvitationToken();
  assert.notEqual(hashInvitationToken(token), token);
});
