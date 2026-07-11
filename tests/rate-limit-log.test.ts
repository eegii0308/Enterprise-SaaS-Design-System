import test from "node:test";
import assert from "node:assert/strict";
import { safeIdentifier, logRateLimitRejection } from "../lib/rate-limit/log.ts";

test("safeIdentifier never returns the raw key", () => {
  const key = "victim@example.com";
  const identifier = safeIdentifier(key);

  assert.notEqual(identifier, key);
  assert.equal(identifier.includes(key), false);
});

test("safeIdentifier is deterministic for the same key", () => {
  const key = "1.2.3.4";
  assert.equal(safeIdentifier(key), safeIdentifier(key));
});

test("safeIdentifier differs for different keys", () => {
  assert.notEqual(safeIdentifier("member-a@example.com"), safeIdentifier("member-b@example.com"));
});

test("safeIdentifier is a short, fixed-length hex string", () => {
  assert.match(safeIdentifier("some-key"), /^[0-9a-f]{12}$/);
});

test("logRateLimitRejection logs without the raw key", () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    logRateLimitRejection({ scope: "auth:login:account", key: "victim@example.com", count: 6, limit: 5 });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 1);
  const [message] = calls[0] as [string];
  assert.equal(typeof message, "string");
  assert.equal(message.includes("victim@example.com"), false);
  assert.match(message, /scope=auth:login:account/);
  assert.match(message, /count=6/);
  assert.match(message, /limit=5/);
});
