import test from "node:test";
import assert from "node:assert/strict";
import { assertSafePublicUrl, checkRateLimit } from "../packages/security/src/index.ts";

test("SSRF guard rejects local and private addresses before fetch", async () => {
  await assert.rejects(() => assertSafePublicUrl("http://localhost:3000/admin"), /Local hosts/);
  await assert.rejects(() => assertSafePublicUrl("http://127.0.0.1/internal"), /Private\/internal/);
});

test("in-process limiter closes a bucket after its allowance", () => {
  const key=`test-${Date.now()}-${Math.random()}`;
  assert.equal(checkRateLimit(key,2,10_000).allowed,true);
  assert.equal(checkRateLimit(key,2,10_000).allowed,true);
  assert.equal(checkRateLimit(key,2,10_000).allowed,false);
});
