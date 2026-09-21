/**
 * GeoJSON MultiPolygon → EWKB, losslessly.
 *
 * Used only to carry a zone too large for one request (see
 * supabase/migrations/20260921041000_chunked_zone_staging.sql). Every coordinate
 * is written as the same IEEE-754 double JSON.parse produced from the authority's
 * text, so the database decodes exactly the boundary the adapter read. Nothing is
 * rounded, simplified, reordered or dropped; a ring the adapter did not receive
 * cannot appear, and the assembling function checks the vertex and polygon counts
 * returned here before it stages anything.
 */

const LITTLE_ENDIAN = 1;
const WKB_POLYGON = 3;
const WKB_MULTIPOLYGON = 6;
const EWKB_SRID_FLAG = 0x20000000;

function assertPosition(position) {
  if (!Array.isArray(position) || position.length !== 2 || !position.every(Number.isFinite)) {
    /* A third ordinate would be dropped by a 2D encoding, and a non-finite one
       cannot be a boundary. Either is a source change to review. */
    throw new Error(`Expected a 2D position, got ${JSON.stringify(position)?.slice(0, 80)}`);
  }
}

/** Polygons of a Polygon or MultiPolygon, as arrays of rings. */
function polygonsOf(geometry) {
  if (geometry?.type === "MultiPolygon") return geometry.coordinates;
  if (geometry?.type === "Polygon") return [geometry.coordinates];
  throw new Error(`Only Polygon and MultiPolygon can be encoded, not ${geometry?.type}`);
}

export function geometryCounts(geometry) {
  const polygons = polygonsOf(geometry);
  let points = 0;
  for (const polygon of polygons) for (const ring of polygon) points += ring.length;
  return { points, polygons: polygons.length };
}

export function multiPolygonToEwkb(geometry, srid = 4326) {
  const polygons = polygonsOf(geometry);
  let size = 1 + 4 + 4 + 4;
  for (const polygon of polygons) {
    size += 1 + 4 + 4;
    for (const ring of polygon) size += 4 + ring.length * 16;
  }

  const buffer = Buffer.alloc(size);
  let offset = 0;
  const byte = (value) => { buffer.writeUInt8(value, offset); offset += 1; };
  const uint = (value) => { buffer.writeUInt32LE(value >>> 0, offset); offset += 4; };
  const double = (value) => { buffer.writeDoubleLE(value, offset); offset += 8; };

  byte(LITTLE_ENDIAN);
  uint(WKB_MULTIPOLYGON | EWKB_SRID_FLAG);
  uint(srid);
  uint(polygons.length);
  for (const polygon of polygons) {
    // Parts of an EWKB collection inherit the SRID and do not repeat it.
    byte(LITTLE_ENDIAN);
    uint(WKB_POLYGON);
    uint(polygon.length);
    for (const ring of polygon) {
      uint(ring.length);
      for (const position of ring) {
        assertPosition(position);
        double(position[0]);
        double(position[1]);
      }
    }
  }
  if (offset !== size) throw new Error(`EWKB size mismatch: wrote ${offset} of ${size} bytes`);
  return buffer;
}

/** Base64 pieces no longer than `chunkLength` characters, in order. */
export function base64Chunks(buffer, chunkLength = 600_000) {
  const text = buffer.toString("base64");
  const chunks = [];
  for (let index = 0; index < text.length; index += chunkLength) chunks.push(text.slice(index, index + chunkLength));
  return chunks;
}
