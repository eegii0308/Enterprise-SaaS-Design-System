import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmailKey } from "../lib/rate-limit/keys.ts";

test("normalizeEmailKey lowercases the email", () => {
  assert.equal(normalizeEmailKey("MEMBER@Example.com"), "member@example.com");
});

test("normalizeEmailKey trims surrounding whitespace", () => {
  assert.equal(normalizeEmailKey("  member@example.com  "), "member@example.com");
});

test("normalizeEmailKey produces the same key regardless of case or whitespace", () => {
  assert.equal(normalizeEmailKey(" Member@Example.com"), normalizeEmailKey("member@example.com "));
});
