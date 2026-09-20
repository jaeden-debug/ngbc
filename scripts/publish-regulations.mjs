#!/usr/bin/env node
/**
 * Mirror a generated regulatory bundle into Supabase.
 *
 *   node scripts/publish-regulations.mjs content/regulatory/ca-on-small-game-2026.json
 *
 * Hunt evaluates from the committed bundle, not from the database — that keeps
 * evaluation deterministic, offline-testable and reviewable as a diff. This
 * mirror exists for the operational side: coverage reporting, the review
 * lifecycle, and the eventual regulatory API.
 *
 * The bundle is the source. This script only ever reproduces it, so running it
 * twice changes nothing, and a rule that used to exist is superseded rather than
 * deleted — regulatory history is worth keeping.
 */

import { readFileSync } from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch {
      /* absent is fine */
    }
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

const { url: SUPABASE_URL, key: SERVICE_KEY } = loadEnv();

async function rest(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/publish-regulations.mjs <bundle.json>");
    process.exit(1);
  }
  const bundle = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Publishing ${path}`);
  console.log(`  source ${bundle.source.id} (${bundle.source.sourceVersion}), hash ${bundle.source.contentHash.slice(0, 23)}...`);

  const [jurisdiction] = await rest(
    `regulatory_jurisdictions?canonical_id=eq.${encodeURIComponent(bundle.jurisdictionId)}&select=id`,
  );
  if (!jurisdiction) throw new Error(`Jurisdiction ${bundle.jurisdictionId} is not registered`);

  const [source] = await rest(
    `regulatory_sources?canonical_id=eq.${encodeURIComponent(bundle.source.id)}&select=id,review_status,verified_at`,
  );
  if (!source) throw new Error(`Source ${bundle.source.id} is not registered`);
  if (!["VERIFIED", "PUBLISHED"].includes(source.review_status)) {
    throw new Error(`Source ${bundle.source.id} is ${source.review_status}; refusing to publish rules against it`);
  }

  const zones = await rest(
    `management_zones?jurisdiction_id=eq.${jurisdiction.id}&select=id,canonical_id`,
  );
  const zoneByCanonical = new Map(zones.map((zone) => [zone.canonical_id, zone.id]));
  console.log(`  ${zoneByCanonical.size} zones available for membership`);

  /* ── Groups ───────────────────────────────────────────────────────────── */

  let groupsWritten = 0;
  let membersWritten = 0;
  const groupIdByCanonical = new Map();

  for (const group of bundle.groups) {
    const existing = await rest(`regulatory_groups?canonical_id=eq.${encodeURIComponent(group.id)}&select=id`);
    let id = existing[0]?.id;
    if (!id) {
      const [created] = await rest("regulatory_groups", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          canonical_id: group.id,
          jurisdiction_id: jurisdiction.id,
          label: group.label,
          official_spec: group.officialSpec,
          source_id: source.id,
          source_version: group.sourceVersion,
        }],
      });
      id = created.id;
      groupsWritten += 1;
    }
    groupIdByCanonical.set(group.id, id);

    const missing = group.zoneIds
      .map((canonical) => zoneByCanonical.get(canonical))
      .filter(Boolean)
      .map((zoneId) => ({ group_id: id, management_zone_id: zoneId }));

    const unresolved = group.zoneIds.filter((canonical) => !zoneByCanonical.has(canonical));
    if (unresolved.length) {
      throw new Error(`Group ${group.id} references zones that are not in the registry: ${unresolved.slice(0, 5).join(", ")}`);
    }

    // Membership is rebuilt wholesale so the database always matches the bundle.
    await rest(`regulatory_group_members?group_id=eq.${id}`, { method: "DELETE" });
    for (let index = 0; index < missing.length; index += 200) {
      await rest("regulatory_group_members", {
        method: "POST",
        prefer: "return=minimal",
        body: missing.slice(index, index + 200),
      });
    }
    membersWritten += missing.length;
  }

  /* ── Rules ────────────────────────────────────────────────────────────── */

  let rulesWritten = 0;
  for (const rule of bundle.rules) {
    const existing = await rest(`regulatory_rules?canonical_id=eq.${encodeURIComponent(rule.id)}&select=id`);
    if (existing[0]) continue;

    await rest("regulatory_rules", {
      method: "POST",
      prefer: "return=minimal",
      body: [{
        canonical_id: rule.id,
        jurisdiction_id: jurisdiction.id,
        regulatory_group_id: groupIdByCanonical.get(rule.regulatoryGroupId),
        management_zone_id: null,
        species_canonical_id: rule.speciesId,
        regulatory_status: "CONDITIONAL",
        // Season anchors live in the bundle, which understands cross-year and
        // last-day-of-month wording. The database keeps the authority's phrase.
        season_opens: null,
        season_closes: null,
        dates_inclusive: true,
        limits: {
          daily: rule.limits.daily,
          possession: rule.limits.possession,
          combined: rule.limits.combined,
          combinedWith: rule.limits.combinedWith,
          statedAs: rule.limits.statedAs,
        },
        requirements: [],
        limitations: [],
        legal_time_rule: { statedAs: rule.seasonPhrase, section: rule.sourceSection },
        source_id: source.id,
        source_verified_at: source.verified_at,
        effective_from: `${rule.sourceYear}-01-01`,
        effective_to: null,
        source_version: rule.sourceVersion,
        review_status: rule.reviewStatus,
      }],
    });
    rulesWritten += 1;
  }

  /* ── Supersede anything the bundle replaced ───────────────────────────── */

  const current = new Set(bundle.rules.map((rule) => rule.id));
  const published = await rest(
    `regulatory_rules?jurisdiction_id=eq.${jurisdiction.id}&review_status=in.(VERIFIED,PUBLISHED)&select=id,canonical_id`,
  );
  let superseded = 0;
  for (const row of published) {
    if (current.has(row.canonical_id)) continue;
    await rest(`regulatory_rules?id=eq.${row.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { review_status: "SUPERSEDED" },
    });
    console.log(`  superseded ${row.canonical_id}`);
    superseded += 1;
  }

  console.log("");
  console.log(`Groups created   ${groupsWritten} (${bundle.groups.length} in bundle)`);
  console.log(`Memberships      ${membersWritten}`);
  console.log(`Rules created    ${rulesWritten} (${bundle.rules.length} in bundle)`);
  console.log(`Rules superseded ${superseded}`);
}

main().catch((error) => {
  console.error(`Publish failed: ${error.message}`);
  process.exit(1);
});
