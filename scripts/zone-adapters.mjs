/**
 * Jurisdictions whose official zone layer North Ground can ingest and certify.
 *
 * One list, shared by `ingest-zone-layer.mjs` and `certify-spatial-parity.mjs`,
 * so a jurisdiction cannot be ingestible without being certifiable or the
 * reverse. Adding a jurisdiction is one entry here plus its adapter.
 */
export const ZONE_ADAPTERS = {
  "ca-ab": {
    module: "../src/lib/hunt/ingestion/alberta-wmu.ts",
    factory: "createAlbertaWmuSource",
  },
  "ca-on": {
    module: "../src/lib/hunt/ingestion/ontario-wmu.ts",
    factory: "createOntarioWmuSource",
  },
};

export async function loadZoneSource(jurisdiction) {
  const adapter = ZONE_ADAPTERS[jurisdiction];
  if (!adapter) {
    throw new Error(`Unknown jurisdiction "${jurisdiction}". Known: ${Object.keys(ZONE_ADAPTERS).join(", ")}`);
  }
  const loaded = await import(adapter.module);
  return loaded[adapter.factory]();
}
