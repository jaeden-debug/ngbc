/**
 * Which parts of an authority's range map North Ground imports (range-habitat
 * 2.4.0). Pure: a runner's read in, a decision out.
 *
 * USGS GAP CONUS_2001. Each species' map is a table of sub-watersheds (HUC12)
 * with origin, presence, reproduction and season, and a shapefile of those
 * sub-watersheds dissolved by SEASON alone. The shapefile cannot tell known
 * ground from possibly present, extirpated or historical ground, so it is
 * imported only where the table says every sub-watershed is "Known/extant":
 * then the dissolved shapefile is exactly the known range. A map that mixes in
 * any other presence is refused with its counts rather than drawn, because the
 * builder would draw historical or merely possible ground as range.
 */

const SEASONS = { "Year-round": "YEAR_ROUND", "Summer Only": "SUMMER", "Winter Only": "WINTER" };
export const KNOWN = "Known/extant";

export function gapSelection(read) {
  if (read.error) return { import: false, why: `the read failed: ${read.error}` };
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
  return { import: true, published: read.published, why: `every one of ${presence[KNOWN]} sub-watersheds is "${KNOWN}"; seasons ${Object.keys(cells).join(", ")}${unseasoned ? `; ${unseasoned} cells of polygons with no season left out` : ""}`, cells };
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
