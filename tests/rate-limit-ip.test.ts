import test from "node:test";
import assert from "node:assert/strict";
import { getClientIp, type HeaderLookup } from "../lib/rate-limit/ip.ts";

function fakeHeaders(values: Record<string, string>): HeaderLookup {
  return {
    get(name: string) {
      return values[name] ?? null;
    },
  };
}

test("getClientIp reads the first address from x-forwarded-for", () => {
  const headers = fakeHeaders({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
  assert.equal(getClientIp(headers), "1.2.3.4");
});

test("getClientIp trims whitespace around the first address", () => {
  const headers = fakeHeaders({ "x-forwarded-for": "  1.2.3.4  , 10.0.0.1" });
  assert.equal(getClientIp(headers), "1.2.3.4");
});

test("getClientIp falls back to x-real-ip when x-forwarded-for is absent", () => {
  const headers = fakeHeaders({ "x-real-ip": "9.9.9.9" });
  assert.equal(getClientIp(headers), "9.9.9.9");
});

test("getClientIp falls back to x-real-ip when x-forwarded-for is empty", () => {
  const headers = fakeHeaders({ "x-forwarded-for": "", "x-real-ip": "9.9.9.9" });
  assert.equal(getClientIp(headers), "9.9.9.9");
});

test("getClientIp returns unknown when no address header is present", () => {
  const headers = fakeHeaders({});
  assert.equal(getClientIp(headers), "unknown");
});
