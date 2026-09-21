#!/usr/bin/env node
/**
 * Build the catalogue of Québec's hunting-prohibited areas.
 *
 *   node scripts/build-quebec-overlays.mjs          # rebuild
 *   node scripts/build-quebec-overlays.mjs --check  # exit 2 if the layer moved
 *
 * Reads the ministry's own layer, SmartFaunePub:Chasse_Interdite, which the
 * service describes as « Territoires où toute activité de chasse est interdite »:
 * ecological reserves, Québec and federal national parks, and territories the
 * ministry designates as closed to hunting. Hunt asks the same service which of
 * these contain a point, and reads the answer against this catalogue.
 *
 * Identity is the service's own feature id, not the OBJECTID attribute: 34 of
 * the 130 features carry OBJECTID 0.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { jurisdictionToday } from "./ontario-source.mjs";

const OUTPUT = "content/regulatory/ca-qc-overlays.json";
const WFS = "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows";
const TYPE_NAME = "SmartFaunePub:Chasse_Interdite";
const LAYER_STATEMENT = "Territoires où toute activité de chasse est interdite.";

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { accept: "application/json" } });
      if (response.status >= 400 && response.status < 500) throw Object.assign(new Error(`HTTP ${response.status}`), { permanent: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.permanent || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3_000 * attempt));
    }
  }
}

async function main() {
  const check = process.argv.includes("--check");

  /* The layer's own statement of what it means, read from the service rather
     than assumed: if the ministry rewords it, the catalogue must be reviewed. */
  const capabilities = await (await fetch(`${WFS}?service=WFS&version=2.0.0&request=GetCapabilities`, {
    signal: AbortSignal.timeout(90_000),
  })).text();
  const block = new RegExp(`<Name>${TYPE_NAME}</Name>([\\s\\S]*?)</FeatureType>`).exec(capabilities)?.[1] ?? "";
  const abstract = /<Abstract>([\s\S]*?)<\/Abstract>/.exec(block)?.[1]?.trim();
  if (abstract !== LAYER_STATEMENT) {
    throw new Error(`The layer's own description changed: ${JSON.stringify(abstract)}. Review before rebuilding.`);
  }

  const parameters = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: TYPE_NAME, outputFormat: "application/json",
    propertyName: "TOPONYME,NOM,DESIG_GR,DESIGNOM,RESPONSABL,LIEN,SHAPE_AREA",
  });
  const payload = await fetchJson(`${WFS}?${parameters}`);
  const rows = payload.features ?? [];
  const expected = payload.numberMatched ?? payload.totalFeatures;
  if (!rows.length || rows.length !== expected) {
    throw new Error(`Read ${rows.length} of ${expected ?? "?"} prohibited-area features; refusing a partial catalogue.`);
  }

  const seen = new Set();
  const features = rows.map((row) => {
    const match = /\.(\d+)$/.exec(String(row.id ?? ""));
    if (!match) throw new Error(`Feature without a readable id: ${JSON.stringify(row.id)}`);
    const objectId = Number(match[1]);
    if (seen.has(objectId)) throw new Error(`Duplicate feature id ${row.id}`);
    seen.add(objectId);
    const properties = row.properties ?? {};
    const name = String(properties.TOPONYME ?? properties.NOM ?? "").trim();
    const designation = String(properties.DESIGNOM ?? properties.DESIG_GR ?? "").trim();
    if (!name || !designation) throw new Error(`Feature ${row.id} has no name or designation`);
    /* The one feature designated "non permise ou restreinte" says so in its own
       words, so a reader sees that it may be restricted rather than closed. */
    const restricted = /restreinte/i.test(String(properties.DESIG_GR ?? ""));
    /* The official toponym alone: it already says what the place is ("Parc
       national de la Jacques-Cartier"), and the designation is quoted in
       statedAs. The responsible body is not a regulation, so it is not
       recorded as one. */
    return {
      objectId,
      name,
      statedAs: restricted
        ? `« ${String(properties.DESIG_GR).trim()} » (the ministry's layer of hunting-prohibited territories).`
        : `« ${LAYER_STATEMENT} » (${designation}).`,
      tokens: ["all"],
      unclassified: [],
      specialIds: [],
    };
  }).sort((a, b) => a.objectId - b.objectId);

  const catalogue = {
    jurisdictionId: "jurisdiction:ca-qc",
    layers: [{
      key: "chasse-interdite",
      url: WFS,
      protocol: "WFS",
      typeName: TYPE_NAME,
      sourceId: "source:ca-qc-chasse-interdite-service",
      features,
    }],
  };
  const hash = `sha256:${createHash("sha256").update(JSON.stringify(features)).digest("hex")}`;
  let previous = null;
  try { previous = JSON.parse(readFileSync(OUTPUT, "utf8")); } catch { /* none yet */ }
  /* Re-reading an unchanged layer does not change when its content was
     retrieved, so the date moves only with the content; a rebuild of the same
     layer is then byte-identical. The day is Québec's, never a UTC slice. */
  const retrievedAt = previous?.contentHash === hash && previous?.retrievedAt
    ? previous.retrievedAt
    : jurisdictionToday("America/Toronto");
  const serialized = `${JSON.stringify({ ...catalogue, retrievedAt, contentHash: hash }, null, 2)}\n`;

  if (check) {
    if (previous?.contentHash === hash) {
      console.log(`Prohibited-area layer unchanged (${features.length} features, ${hash}).`);
      return;
    }
    const before = new Map((previous?.layers?.[0]?.features ?? []).map((feature) => [feature.objectId, feature]));
    const after = new Map(features.map((feature) => [feature.objectId, feature]));
    for (const [id, feature] of after) if (!before.has(id)) console.error(`  ADDED    ${id} ${feature.name}`);
    for (const [id, feature] of before) if (!after.has(id)) console.error(`  REMOVED  ${id} ${feature.name}`);
    for (const [id, feature] of after) {
      const prior = before.get(id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(feature)) console.error(`  CHANGED  ${id} ${prior.name} -> ${feature.name}`);
    }
    console.error("The prohibited-area layer has changed since the catalogue was built. Review, then rebuild.");
    process.exit(2);
  }

  writeFileSync(OUTPUT, serialized);
  const byType = new Map();
  for (const row of rows) {
    const designation = String(row.properties?.DESIGNOM ?? row.properties?.DESIG_GR ?? "").trim();
    byType.set(designation, (byType.get(designation) ?? 0) + 1);
  }
  console.log(`Wrote ${OUTPUT}: ${features.length} features`);
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${type}`);
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
