/**
 * The one way content/intelligence/surface-profiles.json is written: a
 * profile per block, each field on its own line, small values inline. A
 * reviewer reads a profile as a unit, and a diff shows the field that changed.
 */
const inline = (value) => JSON.stringify(value, null, 1).replace(/\n\s*/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]");

export function formatProfiles(profiles) {
  const lines = ["{"];
  const top = Object.entries(profiles);
  top.forEach(([key, value], i) => {
    const comma = i < top.length - 1 ? "," : "";
    if (key === "groupAliases" || key === "families" || key === "species") {
      const entries = Object.entries(value);
      lines.push(`  ${JSON.stringify(key)}: {`);
      entries.forEach(([name, entry], j) => {
        const inner = j < entries.length - 1 ? "," : "";
        if (key !== "species") {
          lines.push(`    ${JSON.stringify(name)}: ${inline(entry)}${inner}`);
          return;
        }
        const fields = Object.entries(entry);
        lines.push(`    ${JSON.stringify(name)}: {`);
        fields.forEach(([field, v], k) => lines.push(`      ${JSON.stringify(field)}: ${inline(v)}${k < fields.length - 1 ? "," : ""}`));
        lines.push(`    }${inner}`);
      });
      lines.push(`  }${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${inline(value)}${comma}`);
    }
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
