/**
 * Joining the gaps occurrence records leave inside a range (range-and-habitat
 * 2.1.0). Pure: a grid in, a grid out, no files.
 *
 * Records are made where people look. Between two recorded places an animal
 * that lives on both sides usually lives in between too, and a range drawn only
 * around the records paints the sampling as holes — central Florida blank for
 * the alligator because few openly licensed photographs were taken there.
 *
 * The rule is a morphological CLOSING by a disc of half the family's declared
 * `gapKm`: grow the range by that radius, then shrink it back by the same
 * radius. Its properties are what make it safe, and the tests hold each:
 *   - it never removes ground from the range;
 *   - it fills a gap only if the gap is at most `gapKm` wide;
 *   - it never adds ground more than `gapKm / 2` from the range it was given,
 *     and never outside that range's convex hull — so it can join recorded
 *     ground, and can never extend the range past its recorded edge.
 * Habitat still decides every cell inside: ground a gap-join brings into the
 * range that the profile rates unsuitable, or that is water or town, is
 * UNSUITABLE, not painted.
 */

const KM_PER_DEGREE = 111.2;

/** @typedef {{ rows: number, columns: number, north: number, cell: number }} Grid */

/* Mark every cell within radiusKm of (row, col). */
function stamp(grid, target, row, col, radiusKm) {
  const kmPerRow = grid.cell * KM_PER_DEGREE;
  const lat = grid.north - (row + 0.5) * grid.cell;
  const kmPerCol = kmPerRow * Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dr = Math.ceil(radiusKm / kmPerRow);
  const dc = Math.ceil(radiusKm / kmPerCol);
  const limit = radiusKm * radiusKm;
  for (let r = Math.max(0, row - dr); r <= Math.min(grid.rows - 1, row + dr); r += 1) {
    const y = (r - row) * kmPerRow;
    for (let c = Math.max(0, col - dc); c <= Math.min(grid.columns - 1, col + dc); c += 1) {
      const x = (c - col) * kmPerCol;
      if (x * x + y * y <= limit) target[r * grid.columns + c] = 1;
    }
  }
}

/* Grow a set by a disc: every cell within radiusKm of a member. Only members on
   the set's edge need a disc, since any cell near the set is near its edge. */
function grow(grid, set, radiusKm) {
  const out = Uint8Array.from(set);
  const { rows, columns } = grid;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const cell = row * columns + col;
      if (!set[cell]) continue;
      const edge = (row > 0 && !set[cell - columns]) || (row < rows - 1 && !set[cell + columns])
        || (col > 0 && !set[cell - 1]) || (col < columns - 1 && !set[cell + 1]);
      if (edge) stamp(grid, out, row, col, radiusKm);
    }
  }
  return out;
}

/**
 * Close a range's gaps no wider than gapKm. Returns the closed range and how
 * many cells the closing added.
 * @param {Grid} grid
 * @param {Uint8Array} inRange 1 = inside the range
 * @param {number | null} gapKm
 */
export function closeRange(grid, inRange, gapKm) {
  if (!gapKm) return { inRange, added: 0 };
  const radius = gapKm / 2;
  const grown = grow(grid, inRange, radius);
  /* Shrink = the complement of the complement grown. Ground beyond the grid is
     outside too, so the grid's own edge shrinks grown ground near it. */
  const outside = new Uint8Array(grown.length);
  for (let i = 0; i < grown.length; i += 1) outside[i] = grown[i] ? 0 : 1;
  const outsideGrown = grow(grid, outside, radius);
  const { rows, columns } = grid;
  for (let row = 0; row < rows; row += 1) {
    const edgeRow = row === 0 || row === rows - 1;
    for (let col = 0; col < columns; col += edgeRow ? 1 : Math.max(1, columns - 1)) stamp(grid, outsideGrown, row, col, radius);
  }
  const closed = Uint8Array.from(inRange);
  let added = 0;
  for (let i = 0; i < grown.length; i += 1) {
    if (!inRange[i] && grown[i] && !outsideGrown[i]) {
      closed[i] = 1;
      added += 1;
    }
  }
  return { inRange: closed, added };
}
