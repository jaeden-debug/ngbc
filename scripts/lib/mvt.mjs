/**
 * A minimal Mapbox Vector Tile reader: layers, features, their properties and
 * decoded geometry in tile coordinates. Enough to read counts from a map API
 * without adding a dependency. Spec: https://github.com/mapbox/vector-tile-spec
 */

function reader(buffer) {
  let pos = 0;
  const varint = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = buffer[pos++];
      result += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return result;
      shift += 7;
    }
  };
  const fields = (end, onField) => {
    while (pos < end) {
      const key = varint();
      const field = Math.floor(key / 8);
      const wire = key & 7;
      if (wire === 0) onField(field, wire, varint());
      else if (wire === 2) {
        const length = varint();
        const start = pos;
        pos += length;
        onField(field, wire, { start, end: start + length });
      } else if (wire === 1) { onField(field, wire, buffer.readDoubleLE(pos)); pos += 8; }
      else if (wire === 5) { onField(field, wire, buffer.readFloatLE(pos)); pos += 4; }
      else throw new Error(`unsupported wire type ${wire}`);
    }
  };
  const packed = ({ start, end }) => {
    const saved = pos;
    pos = start;
    const out = [];
    while (pos < end) out.push(varint());
    pos = saved;
    return out;
  };
  const string = ({ start, end }) => buffer.toString("utf8", start, end);
  const within = ({ start, end }, fn) => { const saved = pos; pos = start; fn(end); pos = saved; };
  return { fields, packed, string, within, varint, get pos() { return pos; }, set pos(value) { pos = value; } };
}

const zigzag = (n) => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

function geometry(commands) {
  const rings = [];
  let ring = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < commands.length;) {
    const command = commands[i] & 7;
    const count = commands[i] >> 3;
    i += 1;
    if (command === 7) { if (ring) ring.push(ring[0]); continue; }
    for (let k = 0; k < count; k += 1) {
      x += zigzag(commands[i]);
      y += zigzag(commands[i + 1]);
      i += 2;
      if (command === 1) { ring = [[x, y]]; rings.push(ring); } else ring.push([x, y]);
    }
  }
  return rings;
}

/** Every layer's features: { layer, extent, type, properties, rings }. */
export function readTile(buffer) {
  const r = reader(buffer);
  const out = [];
  r.fields(buffer.length, (field, wire, value) => {
    if (field !== 3 || wire !== 2) return;
    const layer = { name: "", extent: 4096, keys: [], values: [], features: [] };
    r.within(value, (end) => {
      r.fields(end, (lf, lw, lv) => {
        if (lf === 1) layer.name = r.string(lv);
        else if (lf === 5) layer.extent = lv;
        else if (lf === 3) layer.keys.push(r.string(lv));
        else if (lf === 4) {
          let v = null;
          r.within(lv, (vend) => r.fields(vend, (vf, vw, vv) => {
            if (vf === 1) v = r.string(vv);
            else if (vf === 2 || vf === 3) v = vv;
            else if (vf === 4 || vf === 5) v = vv;
            else if (vf === 6) v = zigzag(vv);
            else if (vf === 7) v = Boolean(vv);
          }));
          layer.values.push(v);
        } else if (lf === 2) {
          const feature = { type: 0, tags: [], commands: [] };
          r.within(lv, (fend) => r.fields(fend, (ff, fw, fv) => {
            if (ff === 3) feature.type = fv;
            else if (ff === 2) feature.tags = r.packed(fv);
            else if (ff === 4) feature.commands = r.packed(fv);
          }));
          layer.features.push(feature);
        }
      });
    });
    for (const feature of layer.features) {
      const properties = {};
      for (let i = 0; i < feature.tags.length; i += 2) properties[layer.keys[feature.tags[i]]] = layer.values[feature.tags[i + 1]];
      out.push({ layer: layer.name, extent: layer.extent, type: feature.type, properties, rings: geometry(feature.commands) });
    }
  });
  return out;
}
