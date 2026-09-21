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
import { pathToFileURL } from "node:url";

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

/**
 * Dimensions this publisher knows how to store faithfully.
 *
 * Deliberately an allow-list. A new dimension appearing in a bundle must fail
 * the publish loudly rather than be silently dropped, because a dropped
 * condition turns a narrow rule into a broad one.
 */
export const REPRESENTABLE_DIMENSIONS = new Set(["RESIDENCY", "HUNT_METHOD", "TAG_TYPE", "SEASON_TYPE", "permittedImplements"]);

/**
 * Which published rules this bundle is entitled to retire.
 *
 * Scoped to the sources the bundle is built from, which is the boundary of what
 * it can speak for. A jurisdiction-wide sweep looks equivalent while only one
 * bundle exists and turns destructive the moment a second one does: publishing
 * major game would retire every small-game rule, and publishing small game
 * would then retire every major-game rule, each run quietly undoing the last.
 * A bundle owns the rules derived from its own published pages and nothing else.
 *
 * Exported so that boundary is asserted by a test rather than by a comment.
 */
export function supersedeQuery(jurisdictionId, ownedSourceIds) {
  if (!ownedSourceIds.length) {
    throw new Error("Refusing to supersede: the bundle declares no source to scope by");
  }
  return (
    `regulatory_rules?jurisdiction_id=eq.${jurisdictionId}` +
    `&source_id=in.(${ownedSourceIds.join(",")})` +
    "&review_status=in.(VERIFIED,PUBLISHED)&select=id,canonical_id"
  );
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/publish-regulations.mjs <bundle.json>");
    process.exit(1);
  }
  const bundle = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Publishing ${path}`);

  /* Small game rests on one published page and carries `source`; major game
     rests on four and carries `sources`. Both are normalised to a list here so
     the rest of the publisher never has to know which kind it is reading. */
  const bundleSources = bundle.sources ?? (bundle.source ? [bundle.source] : []);
  if (!bundleSources.length) throw new Error("Bundle declares no source; refusing to publish");
  for (const declared of bundleSources) {
    console.log(`  source ${declared.id} (${declared.sourceVersion}), hash ${declared.contentHash.slice(0, 23)}...`);
  }

  const [jurisdiction] = await rest(
    `regulatory_jurisdictions?canonical_id=eq.${encodeURIComponent(bundle.jurisdictionId)}&select=id`,
  );
  if (!jurisdiction) throw new Error(`Jurisdiction ${bundle.jurisdictionId} is not registered`);

  /* Every source the bundle rests on must already be registered and reviewed.
     Publishing a rule against an unreviewed source would put law into the store
     that nobody has checked. */
  const sourceByCanonical = new Map();
  for (const declared of bundleSources) {
    const [row] = await rest(
      `regulatory_sources?canonical_id=eq.${encodeURIComponent(declared.id)}&select=id,review_status,verified_at`,
    );
    if (!row) throw new Error(`Source ${declared.id} is not registered`);
    if (!["VERIFIED", "PUBLISHED"].includes(row.review_status)) {
      throw new Error(`Source ${declared.id} is ${row.review_status}; refusing to publish rules against it`);
    }
    sourceByCanonical.set(declared.id, row);
  }
  /* Groups are written against the first declared source, which is the page the
     zone groupings themselves come from. */
  const source = sourceByCanonical.get(bundleSources[0].id);

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

    /* A rule is written with its conditions or it is not written at all.
       `appliesWhen` is what makes a WMU 71 deer season shotgun-only; persisted
       without it the row says the season is open to anyone holding any legal
       implement, which is the one failure this publisher must never produce.
       An unrecognised dimension is therefore fatal rather than dropped. */
    const appliesWhen = rule.appliesWhen ?? {};
    const unrepresentable = Object.keys(appliesWhen).filter((key) => !REPRESENTABLE_DIMENSIONS.has(key));
    if (unrepresentable.length) {
      throw new Error(
        `Rule ${rule.id} is conditional on ${unrepresentable.join(", ")}, which this publisher cannot represent. ` +
        "Extend the schema and this script together, or the rule would be stored as unconditional.",
      );
    }

    const ruleSource = sourceByCanonical.get(rule.sourceId);
    if (!ruleSource) throw new Error(`Rule ${rule.id} cites unregistered source ${rule.sourceId}`);

    const [created] = await rest("regulatory_rules", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        canonical_id: rule.id,
        jurisdiction_id: jurisdiction.id,
        regulatory_group_id: groupIdByCanonical.get(rule.regulatoryGroupId),
        management_zone_id: null,
        species_canonical_id: rule.speciesId,
        /* The authority saying "None" is a stated closure. A unit no row names
           is UNKNOWN and is simply absent from this table. Never merged. */
        regulatory_status: rule.declaredNoSeason ? "CLOSED" : "CONDITIONAL",
        applies_when: appliesWhen,
        declared_no_season: rule.declaredNoSeason === true,
        season_label: rule.seasonLabel ?? null,
        // Season anchors live in the bundle, which understands cross-year and
        // last-day-of-month wording. The database keeps the authority's phrase.
        season_opens: null,
        season_closes: null,
        dates_inclusive: true,
        limits: rule.limits
          ? {
              daily: rule.limits.daily,
              possession: rule.limits.possession,
              combined: rule.limits.combined,
              combinedWith: rule.limits.combinedWith,
              statedAs: rule.limits.statedAs,
            }
          : {},
        requirements: rule.conditionIds ?? [],
        legal_time_rule: { statedAs: rule.seasonPhrase, section: rule.sourceSection },
        limitations: rule.caveats ?? [],
        source_id: ruleSource.id,
        source_verified_at: ruleSource.verified_at,
        effective_from: `${rule.sourceYear}-01-01`,
        effective_to: null,
        source_version: rule.sourceVersion,
        review_status: rule.reviewStatus,
      }],
    });

    /* Rule-level provenance: which published page, and which section of it. */
    await rest("regulatory_rule_sources", {
      method: "POST",
      prefer: "return=minimal",
      body: [{
        rule_id: created.id,
        source_id: ruleSource.id,
        source_section: rule.sourceSection ?? null,
        is_primary: true,
      }],
    });
    rulesWritten += 1;
  }

  /* ── Supersede anything THIS bundle replaced ──────────────────────────── */

  const ownedSourceIds = [...sourceByCanonical.values()].map((row) => row.id);
  const current = new Set(bundle.rules.map((rule) => rule.id));
  const published = await rest(supersedeQuery(jurisdiction.id, ownedSourceIds));
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

/* Only run as a command. The dimension allow-list above is imported by tests,
   and importing this file must not start a publish. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Publish failed: ${error.message}`);
    process.exit(1);
  });
}
