import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const validator = join(root, "scripts/validate-content-contract.mjs");
const fixturePath = join(root, "fixtures/content-contract/valid-bundle.json");

function run(args) {
  return spawnSync(process.execPath, [validator, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function withBundle(mutator, callback) {
  const directory = mkdtempSync(join(tmpdir(), "ngbc-contract-test-"));
  const file = join(directory, "bundle.json");
  const bundle = JSON.parse(readFileSync(fixturePath, "utf8"));
  mutator(bundle);
  writeFileSync(file, JSON.stringify(bundle));
  try {
    callback(file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("valid normalized bundle passes strict validation", () => {
  const result = run(["--strict", fixturePath]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /0 error\(s\), 0 warning\(s\)/);
});

test("duplicate canonical resource IDs fail strict validation", () => {
  withBundle(
    (bundle) => bundle.resources.push(structuredClone(bundle.resources[0])),
    (file) => {
      const result = run(["--strict", file]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /DUPLICATE_VALUE/);
      assert.match(result.stdout, /DUPLICATE_CANONICAL_SLUG/);
    },
  );
});

test("verified claims require a resolvable source", () => {
  withBundle(
    (bundle) => bundle.claims.push({
      id: "claim:fixture",
      ownerId: "guide:ruffed-grouse-cold-weather",
      sourceIds: [],
      support: "direct",
      verificationStatus: "verified"
    }),
    (file) => {
      const result = run(["--strict", file]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /VERIFIED_CLAIM_WITHOUT_SOURCE/);
    },
  );
});

test("warning rollout reports errors without failing the process", () => {
  withBundle(
    (bundle) => { bundle.resources[0].slug = "Invalid Slug"; },
    (file) => {
      const result = run(["--mode=warn", file]);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /INVALID_SLUG/);
    },
  );
});

test("species scientific names must match their taxonomy fields", () => {
  withBundle(
    (bundle) => {
      const resource = bundle.resources[0];
      resource.type = "species";
      resource.quickAnswer = "A direct answer.";
      resource.speciesProfile = {
        speciesId: "species:ruffed-grouse",
        commonNames: [{ locale: "en-CA", value: "Ruffed grouse" }],
        scientificName: "Incorrect name",
        taxonomy: { genus: "Bonasa", species: "umbellus", taxonomySourceId: "source:ontario-small-game" },
        speciesGroupIds: [], identification: [], sourceIds: ["source:ontario-small-game"],
        verificationStatus: "verified", lastReviewed: "2026-09-20"
      };
    },
    (file) => {
      const result = run(["--strict", file]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /INVALID_SCIENTIFIC_NAME/);
    },
  );
});

test("duplicate aliases and unverified species media fail publication validation", () => {
  withBundle(
    (bundle) => {
      const species = bundle.entities.find((entity) => entity.type === "species");
      species.aliases ??= [];
      species.aliases.push({ value: "Duplicate", type: "common_name", verificationStatus: "verified" });
      species.aliases.push({ value: "duplicate", type: "common_name", verificationStatus: "verified" });
      bundle.media.push({
        id: "media:test", kind: "image", sourceType: "unsplash", creator: "Photographer", licence: "Unsplash",
        assetUrl: "https://images.unsplash.com/test", depictsSpeciesIds: [species.id], identityVerification: "unverified",
        locationDisclosure: "none", status: "active"
      });
    },
    (file) => {
      const result = run(["--strict", file]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /DUPLICATE_ALIAS/);
      assert.match(result.stdout, /UNVERIFIED_SPECIES_MEDIA/);
      assert.match(result.stdout, /INCOMPLETE_UNSPLASH_ATTRIBUTION/);
    },
  );
});
