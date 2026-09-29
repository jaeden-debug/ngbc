import { readFileSync, readdirSync } from "node:fs";
import { ZONE_LAYERS } from "../../src/lib/hunt/zone-layers.ts";
import { regulatoryEntryFor } from "../../src/lib/hunt/regulatory/registry.ts";
import { zoneStatesForSpecies } from "../../src/lib/hunt/exploration/zone-summary.ts";

const DATE = process.argv[2] ?? "2026-09-29";
const units = new Map<string, string[]>();
for (const f of readdirSync("content/regulatory").filter((n) => n.endsWith("-certified-units.json"))) {
  const d = JSON.parse(readFileSync(`content/regulatory/${f}`, "utf8"));
  const list = (d.certifiedUnits ?? []).map((u: unknown) => (typeof u === "string" ? u : (u as { designation?: string }).designation)).filter(Boolean);
  if (d.jurisdictionId && list.length) units.set(d.jurisdictionId, list);
}

const rows: Array<{ pair: string; zones: number; open: number; universal: string[]; sample: string }> = [];
for (const layer of ZONE_LAYERS) {
  if (!layer.serving || !layer.rulesServing) continue;
  const designations = units.get(layer.jurisdictionId);
  if (!designations?.length) { console.log(`(no offline units for ${layer.jurisdictionId} / ${layer.id})`); continue; }
  const entry = regulatoryEntryFor(layer.jurisdictionId);
  if (!entry) continue;
  const speciesIds = [...new Set(entry.coverage().species.map((row: { speciesId: string }) => row.speciesId))];
  console.log(`${layer.id}: ${designations.length} units, ${speciesIds.length} certified species`);
  for (const speciesId of speciesIds) {
    const zones = designations.map((designation) => ({ layerId: layer.id, designation }));
    const states = await zoneStatesForSpecies(speciesId as never, DATE, zones as never);
    /* THE DENOMINATOR IS THE WHOLE ANSWERABLE LAYER, not the open zones.
       Universality over open zones only is a different rule and an unsafe one:
       it strips a condition that is universal AMONG the open zones while
       varying across the layer, which is exactly the moose tag gate. */
    /*
       WHY UNKNOWN IS DROPPED, since a filter that narrows a population always
       looks like one narrowed to improve a number.

       It is the opposite. Counting an UNKNOWN zone as one that does NOT carry
       the condition infers ABSENCE FROM NON-RESOLUTION — §8's forbidden
       conversion, in a denominator rather than in an answer. An unresolved zone
       carries no conditions because nothing was resolved there, not because the
       licence stops applying.

       And universality is a question about the LAW: does this condition tell
       one zone from another? Keeping UNKNOWN makes the answer depend on how
       much we have read, so no condition could be universal while any zone is
       unresolved anywhere — and the marker would fire from our ingest backlog
       rather than from the law varying. That is §41A's "fires everywhere, so
       nobody reads it", reached by a different road. (Moderator decision,
       2026-09-29.)
    */
    const answerable = states.filter((s: { opportunity: { coverage: string } }) => s.opportunity.coverage !== "NOT_CERTIFIED" && s.opportunity.coverage !== "UNKNOWN");
    const withOpp = states.filter((s: { opportunity: { hasCurrentLegalOpportunity: boolean } }) => s.opportunity.hasCurrentLegalOpportunity);
    if (!withOpp.length || !answerable.length) continue;
    const counts = new Map<string, { n: number; text: string }>();
    for (const s of withOpp) for (const c of s.opportunity.conditions) {
      const prev = counts.get(c.id); counts.set(c.id, { n: (prev?.n ?? 0) + 1, text: c.text });
    }
    const universal = [...counts.entries()].filter(([, v]) => v.n === answerable.length);
    if (universal.length) {
      rows.push({ pair: `${layer.jurisdictionId} ${speciesId}`, zones: answerable.length, open: withOpp.length,
                  universal: universal.map(([id]) => id), sample: universal[0][1].text.slice(0, 70) });
    }
  }
}
rows.sort((a, b) => b.open - a.open);
console.log(`\nPAIRS WHERE A CONDITION IS PRESENT IN EVERY OPEN ZONE: ${rows.length}\n`);
for (const r of rows) console.log(`open ${String(r.open).padStart(4)} of ${String(r.zones).padEnd(4)} answerable | ${r.pair}  [${r.universal.length}] ${r.sample}`);
const thin = rows.filter((r) => r.open <= 2);
console.log(`\nOf those, OPEN IN 2 ZONES OR FEWER (unstable against coverage growth): ${thin.length}`);
for (const r of thin) console.log(`   ${r.open}/${r.zones} ${r.pair}`);
