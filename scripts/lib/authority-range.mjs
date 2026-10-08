/**
 * Which parts of an authority's range map North Ground imports (range-habitat
 * 2.4.0). Pure: a runner's read in, a decision out.
 *
 * USGS GAP CONUS_2001. Each species' map is a table of sub-watersheds (HUC12)
 * with origin, presence, reproduction and season, and a shapefile of those
 * sub-watersheds dissolved by SEASON alone. The shapefile cannot tell known
 * ground from possibly present, extirpated or historical ground, so it is
 * read from the table itself where the runner placed each sub-watershed on the
 * grid (the HUC12 at each cell's centre, scripts/build-huc12-foundation.py):
 * only "Known/extant" ground is taken. Without that placement the shapefile is
 * imported only where the table says every sub-watershed is "Known/extant",
 * when the dissolved shapefile is exactly the known range, and a map that
 * mixes in any other presence is refused with its counts rather than drawn.
 */

const SEASONS = { "Year-round": "YEAR_ROUND", "Summer Only": "SUMMER", "Winter Only": "WINTER" };
export const KNOWN = "Known/extant";

/* GAP's table seasons. Ground a species only passes through (Migratory) is
   not where it lives in any season, so it is not imported. */
const TABLE_SEASONS = { "Year-round": "YEAR_ROUND", Summer: "SUMMER", Winter: "WINTER" };

export function gapSelection(read) {
  if (read.error) return { import: false, why: `the read failed: ${read.error}` };
  /* Read sub-watershed by sub-watershed where the runner placed the table on
     the grid (HUC12 at each cell's centre): only Known/extant ground is taken,
     so a table that mixes in extirpated or possible ground still gives what it
     knows. */
  if (read.hucParts?.length) {
    if (!read.published) return { import: false, why: "the item's publication date was not read, so the map's age cannot be stated" };
    const cells = {};
    /* Ground GAP calls possibly present or potential is neither range nor a
       finding of absence: an edge against it is not the authority's edge. */
    let uncertain = [];
    let known = 0;
    let total = 0;
    const left = {};
    for (const part of read.hucParts) {
      total += part.hucs;
      if (/^(Possibly present|Potential for presence)$/.test(part.presence)) uncertain = [...uncertain, ...part.cells];
      const season = TABLE_SEASONS[part.season];
      if (part.presence !== KNOWN || !season) {
        const why = part.presence !== KNOWN ? part.presence : `${part.season} (passage only)`;
        left[why] = (left[why] ?? 0) + part.hucs;
        continue;
      }
      known += part.hucs;
      cells[season] = [...(cells[season] ?? []), ...part.cells].sort((a, b) => a[0] - b[0]);
    }
    if (!Object.keys(cells).length) return { import: false, why: `no sub-watershed is "${KNOWN}" in a season the species lives in` };
    const leftText = Object.entries(left).map(([why, n]) => `${n} "${why}"`).join(", ");
    return { import: true, published: read.published, basis: "HUC12_TABLE", uncertain: uncertain.sort((a, b) => a[0] - b[0]), why: `read by sub-watershed: ${known} of ${total} sub-watersheds are "${KNOWN}" and are taken${leftText ? `; left out: ${leftText}` : ""}; seasons ${Object.keys(cells).join(", ")}`, cells };
  }
  if (!read.parts?.length) return { import: false, why: "the archive held no range geometry" };
  const tables = Object.values(read.hucCombos ?? {});
  if (!tables.length) return { import: false, why: "the archive held no sub-watershed table, so presence cannot be established" };
  const presence = {};
  for (const table of tables) {
    for (const [key, n] of Object.entries(table)) {
      const value = key.split("|")[1];
      presence[value] = (presence[value] ?? 0) + n;
    }
  }
  const other = Object.entries(presence).filter(([value]) => value !== KNOWN);
  if (other.length) {
    return { import: false, why: `the sub-watershed table mixes ${other.map(([v, n]) => `${n} "${v}"`).join(", ")} with ${presence[KNOWN] ?? 0} "${KNOWN}", and the dissolved shapefile cannot tell them apart` };
  }
  if (!read.published) return { import: false, why: "the item's publication date was not read, so the map's age cannot be stated" };
  const cells = {};
  let unseasoned = 0;
  for (const part of read.parts) {
    const name = part.attributes?.SeasonName;
    /* A polygon with no season names no time of year it describes; it is left out, and counted. */
    if (name === null || name === undefined) {
      unseasoned += part.cells.reduce((sum, [, n]) => sum + n, 0);
      continue;
    }
    const season = SEASONS[name];
    if (!season) return { import: false, why: `a part carries a season GAP does not define here (${JSON.stringify(part.attributes)})` };
    cells[season] = [...(cells[season] ?? []), ...part.cells].sort((a, b) => a[0] - b[0]);
  }
  if (!Object.keys(cells).length) return { import: false, why: "no part names a season" };
  return { import: true, published: read.published, basis: "DISSOLVED_SHAPEFILE", why: `every one of ${presence[KNOWN]} sub-watersheds is "${KNOWN}"; seasons ${Object.keys(cells).join(", ")}${unseasoned ? `; ${unseasoned} cells of polygons with no season left out` : ""}`, cells };
}

/**
 * The fill rule (2.4.0). Pure: ground already in the range stays; a cell the
 * authority's map covers joins the range only where `recorded(cell)` says the
 * species' group is barely recorded there — where records are made and none
 * is of this species, their silence stands.
 */
export function fillFromAuthority(inRange, authorityInside, wellRecorded) {
  const out = Uint8Array.from(inRange);
  let added = 0;
  for (let cell = 0; cell < out.length; cell += 1) {
    if (out[cell] || !authorityInside[cell] || wellRecorded(cell)) continue;
    out[cell] = 1;
    added += 1;
  }
  return { inRange: out, added };
}
