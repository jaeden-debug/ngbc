#!/usr/bin/env node
/**
 * Mirror Québec's certified rules into Supabase through the shared publisher.
 *
 *   node --experimental-strip-types scripts/publish-quebec-regulations.mjs [--verify]
 *
 * Québec's committed bundle (content/regulatory/ca-qc-2026.json) is bound to the
 * engine as two bundles, big game and small game, because its pages speak for
 * different periods. This writes those two exactly as the engine evaluates them
 * (`quebecPublishableBundles`) and hands each to `publish-regulations.mjs`,
 * which writes, supersedes within the bundle's own sources, and reads every row
 * back. `--verify` only reads back. Any difference exits non-zero.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quebecPublishableBundles } from "../src/lib/hunt/regulatory/quebec.ts";

const verify = process.argv.includes("--verify");
const directory = mkdtempSync(join(tmpdir(), "ca-qc-publish-"));
let failed = false;
for (const bundle of quebecPublishableBundles()) {
  const path = join(directory, `${bundle.bundleId.replace(/^bundle:/, "")}.json`);
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  const run = spawnSync(process.execPath, ["scripts/publish-regulations.mjs", path, ...(verify ? ["--verify"] : [])], { stdio: "inherit" });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
