import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createShareableHuntBrief } from "./model.ts";
import {
  HuntBriefStoreUnavailableError,
  SupabaseHuntBriefStore,
  SupabaseShareCreationLimiter,
} from "./store.ts";
import { huntShareInput, testShareId } from "./test-fixture.ts";

/**
 * The Supabase store replaced the Upstash store. These tests cover the replacement
 * directly — the rest of the hunt-share suite exercises the in-memory store, which
 * would have kept passing even if this implementation were entirely broken.
 *
 * Supabase is stubbed rather than called: persistence behaviour is asserted here, and
 * the SQL behaviour it depends on (immutability, constraints, RLS, rate limiting) is
 * certified separately against a real PostGIS database by `npm run certify:supabase`.
 */

interface InsertCall {
  table: string;
  row: Record<string, unknown>;
}

function briefFixture() {
  return createShareableHuntBrief(huntShareInput(), {
    shareId: testShareId,
    createdAt: "2026-09-20T12:00:00Z",
  });
}

function stubClient(options: {
  insertError?: { code?: string; message?: string } | null;
  selectResult?: { data: { snapshot: unknown } | null; error: { message: string } | null };
  rpcResult?: { data: unknown; error: { message: string } | null };
  calls?: { inserts: InsertCall[]; rpcs: Array<{ fn: string; args: unknown }> };
}): SupabaseClient {
  const calls = options.calls ?? { inserts: [], rpcs: [] };
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.inserts.push({ table, row });
          return Promise.resolve({ error: options.insertError ?? null });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve(
                    options.selectResult ?? { data: null, error: null },
                  );
                },
              };
            },
          };
        },
      };
    },
    rpc(fn: string, args: unknown) {
      calls.rpcs.push({ fn, args });
      return Promise.resolve(options.rpcResult ?? { data: null, error: null });
    },
  } as unknown as SupabaseClient;
}

test("Supabase store persists a Hunt Brief and reports creation", async () => {
  const calls = { inserts: [] as InsertCall[], rpcs: [] as Array<{ fn: string; args: unknown }> };
  const store = new SupabaseHuntBriefStore(stubClient({ calls }));
  const brief = briefFixture();

  assert.equal(await store.create(brief), "created");
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.inserts[0].table, "hunt_brief_snapshots");

  const row = calls.inserts[0].row;
  assert.equal(row.public_share_id, brief.shareId);
  assert.equal(row.schema_version, brief.version);
  assert.equal(row.created_at, brief.createdAt);
  assert.deepEqual(row.snapshot, brief);
});

test("Supabase store writes no private location column", async () => {
  const calls = { inserts: [] as InsertCall[], rpcs: [] as Array<{ fn: string; args: unknown }> };
  await new SupabaseHuntBriefStore(stubClient({ calls })).create(briefFixture());

  const columns = Object.keys(calls.inserts[0].row);
  for (const forbidden of ["latitude", "longitude", "coordinates", "address", "postal_code", "geometry"]) {
    assert.ok(!columns.includes(forbidden), `stored column ${forbidden} would leak private location`);
  }

  // The stored payload itself must also be free of coordinates.
  const serialised = JSON.stringify(calls.inserts[0].row.snapshot);
  for (const forbidden of ["latitude", "longitude", "postalCode", "rawLocation"]) {
    assert.ok(!serialised.includes(forbidden), `snapshot payload leaked ${forbidden}`);
  }
});

test("Supabase store treats a unique violation as an existing snapshot", async () => {
  const store = new SupabaseHuntBriefStore(
    stubClient({ insertError: { code: "23505", message: "duplicate key value" } }),
  );
  assert.equal(await store.create(briefFixture()), "exists");
});

test("Supabase store fails closed when persistence errors", async () => {
  const store = new SupabaseHuntBriefStore(
    stubClient({ insertError: { code: "08006", message: "connection failure" } }),
  );
  await assert.rejects(() => store.create(briefFixture()), HuntBriefStoreUnavailableError);
});

test("Supabase store returns a stored snapshot and null for an unknown id", async () => {
  const brief = briefFixture();
  const found = new SupabaseHuntBriefStore(
    stubClient({ selectResult: { data: { snapshot: brief }, error: null } }),
  );
  assert.deepEqual(await found.get(brief.shareId), brief);

  const missing = new SupabaseHuntBriefStore(
    stubClient({ selectResult: { data: null, error: null } }),
  );
  assert.equal(await missing.get("Unknown123456789012345"), null);
});

test("Supabase store fails closed rather than reporting a missing snapshot on read error", async () => {
  const store = new SupabaseHuntBriefStore(
    stubClient({ selectResult: { data: null, error: { message: "timeout" } } }),
  );
  // A read error must not be indistinguishable from "this brief does not exist",
  // which would render a 404 for a brief that is actually stored.
  await assert.rejects(() => store.get(testShareId), HuntBriefStoreUnavailableError);
});

test("share rate limiter passes the identity hash to the database function", async () => {
  const calls = { inserts: [] as InsertCall[], rpcs: [] as Array<{ fn: string; args: unknown }> };
  const limiter = new SupabaseShareCreationLimiter(
    stubClient({ calls, rpcResult: { data: [{ allowed: true, retry_after_seconds: 600 }], error: null } }),
    8,
    600,
  );

  assert.deepEqual(await limiter.check("a".repeat(32)), { allowed: true, retryAfterSeconds: 600 });
  assert.equal(calls.rpcs.length, 1);
  assert.equal(calls.rpcs[0].fn, "consume_hunt_share_rate_limit");
  assert.deepEqual(calls.rpcs[0].args, {
    p_identity_hash: "a".repeat(32),
    p_limit: 8,
    p_window_seconds: 600,
  });
});

test("share rate limiter reports a denial with its retry window", async () => {
  const limiter = new SupabaseShareCreationLimiter(
    stubClient({ rpcResult: { data: [{ allowed: false, retry_after_seconds: 412 }], error: null } }),
  );
  assert.deepEqual(await limiter.check("b".repeat(32)), { allowed: false, retryAfterSeconds: 412 });
});

test("share rate limiter accepts a single-object result as well as a row set", async () => {
  const limiter = new SupabaseShareCreationLimiter(
    stubClient({ rpcResult: { data: { allowed: true, retry_after_seconds: 30 }, error: null } }),
  );
  assert.deepEqual(await limiter.check("c".repeat(32)), { allowed: true, retryAfterSeconds: 30 });
});

test("share rate limiter fails closed rather than allowing an unmeasured request", async () => {
  const errored = new SupabaseShareCreationLimiter(
    stubClient({ rpcResult: { data: null, error: { message: "function missing" } } }),
  );
  await assert.rejects(() => errored.check("d".repeat(32)), HuntBriefStoreUnavailableError);

  // A malformed response must never be read as "allowed".
  const malformed = new SupabaseShareCreationLimiter(
    stubClient({ rpcResult: { data: [{ allowed: "yes", retry_after_seconds: "soon" }], error: null } }),
  );
  await assert.rejects(() => malformed.check("e".repeat(32)), HuntBriefStoreUnavailableError);
});
