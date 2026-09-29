#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { unitedStatesCoverageMatrix } from "../src/lib/hunt/united-states/coverage-matrix.ts";

const OUT = "content/registry/us-state-coverage-matrix.generated.json";
const body = `${JSON.stringify({ schemaVersion: 1, states: unitedStatesCoverageMatrix() }, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== body) {
    const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
    console.error(`${OUT} is out of date (on disk ${hash(current)}, computed ${hash(body)}).`);
    process.exit(3);
  }
  console.log(`${OUT} matches the all-state production matrix.`);
} else {
  writeFileSync(OUT, body);
  console.log(`Wrote ${OUT}: 50 states and D.C.`);
}
