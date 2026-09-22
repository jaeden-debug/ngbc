/**
 * Shared reading of the Government of Ontario hunting sources.
 *
 * Both the small-game and major-game bundles are built from the same published
 * pages and the same official WMU layer, so the parts that interpret the
 * authority's wording live here once. A change to how a WMU specification is
 * expanded must change both bundles or neither.
 */

import { readFileSync } from "node:fs";

export const WMU_QUERY =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
}

export async function fetchOfficialWmuIdentifiers() {
  const parameters = new URLSearchParams({
    where: "1=1",
    outFields: "OFFICIAL_NAME",
    returnGeometry: "false",
    resultRecordCount: "500",
    f: "json",
  });
  const payload = JSON.parse(await fetchText(`${WMU_QUERY}?${parameters}`));
  const names = (payload.features ?? [])
    .map((feature) => String(feature.attributes?.OFFICIAL_NAME ?? "").trim())
    .filter(Boolean);
  if (names.length < 100) throw new Error(`Official WMU layer returned only ${names.length} units`);
  return names.sort();
}

export function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#39;/g, "'");
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Footnote definitions from a page, keyed by their anchor id.
 *
 * Ontario attaches these to individual WMU tokens inside a season table, and they
 * can contradict the table's own heading: footnote 1 on the deer page says rifles
 * are NOT permitted in the units carrying it, under a table headed "Rifles,
 * shotguns, muzzle-loading guns and bows". Losing that attachment would produce a
 * confidently wrong legal answer, so it is parsed rather than stripped.
 */
export function extractFootnotes(html) {
  const notes = new Map();
  for (const match of html.matchAll(/<li id="(foot-\d+)"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripTags(match[2])
      .replace(/^footnote\s*\d+\s*/i, "")
      .replace(/^\[\d+\]\s*\[\d+\]\s*/, "")
      .replace(/^\[\d+\]\s*/, "")
      .trim();
    if (text) notes.set(match[1], text);
  }
  return notes;
}

/**
 * Split a WMU cell into tokens, keeping each token's footnote references.
 *
 * Returns entries like `{ token: "64B", footnotes: ["foot-1"] }`. The comma split
 * happens on the rendered text while footnote anchors are tracked through the
 * markup, so "64B footnote 1 [1]" stays one token carrying one reference rather
 * than becoming an unparseable string.
 */
export function parseWmuCell(cellHtml) {
  // Mark each footnote anchor with a stable sentinel, then drop the rest of the tags.
  const marked = cellHtml.replace(
    /<a[^>]*href="#(foot-\d+)"[\s\S]*?<\/a>/gi,
    (_match, id) => `\u0001${id}\u0001`,
  );
  const text = decodeEntities(marked.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");

  const out = [];
  for (const rawPart of text.split(",")) {
    const footnotes = [...rawPart.matchAll(/\u0001(foot-\d+)\u0001/g)].map((match) => match[1]);
    let token = rawPart.replace(/\u0001foot-\d+\u0001/g, "");

    // Today the province renders "[1]" inside the footnote anchor, so the
    // sentinel above takes it. If that template changes and a bare marker is
    // left beside the token, RECORD it rather than strip it: a token that keeps
    // the marker matches no unit and aborts the build, but one that quietly
    // loses it publishes a season without the footnote that qualifies it.
    for (const marker of token.matchAll(/\[(\d+)\]/g)) {
      const id = `foot-${marker[1]}`;
      if (!footnotes.includes(id)) footnotes.push(id);
    }
    token = token.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
    if (token) out.push({ token, footnotes });
  }
  return out;
}

/** Heading text paired with the rows of the table that follows it. */
export function extractTables(html) {
  const chunks = html.split(/(<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>|<table[\s\S]*?<\/table>)/i);
  const out = [];
  let heading = null;
  for (const chunk of chunks) {
    if (/^<h[2-4]/i.test(chunk)) {
      heading = stripTags(chunk);
    } else if (/^<table/i.test(chunk)) {
      const rows = [];
      const rawRows = [];
      for (const row of chunk.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
        const rawCells = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
        const cells = rawCells.map(stripTags);
        if (cells.length) {
          rows.push(cells);
          rawRows.push(rawCells);
        }
      }
      out.push({ heading, rows, rawRows });
    }
  }
  return out;
}

/**
 * Expand an official WMU specification against the official layer.
 *
 * Ontario writes bare numbers in season tables while the layer carries lettered
 * sub-units, so "68" has to resolve to 68A and 68B. That is a reading of the
 * source, not a formatting convenience, and callers verify it by checking that
 * the expanded groups partition the layer. Any token that resolves to nothing
 * aborts the build rather than silently shrinking a rule's reach.
 */
export function expandWmuSpec(spec, officialIdentifiers) {
  const byStem = new Map();
  for (const name of officialIdentifiers) {
    const stem = /^(\d+)/.exec(name);
    if (!stem) continue;
    const key = Number(stem[1]);
    if (!byStem.has(key)) byStem.set(key, []);
    byStem.get(key).push(name);
  }

  const out = [];
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const normalised = part.replace(/[–—]/g, "-").replace(/\s+/g, "");
    let matched = [];

    if (/^\d+$/.test(normalised)) {
      matched = byStem.get(Number(normalised)) ?? [];
    } else if (/^\d+[A-Za-z]\d+$/.test(normalised)) {
      // The deer tables write a numbered sub-unit part without its hyphen:
      // "69A1" is the layer's "69A-1", and means that part ONLY, not all of 69A.
      const exact = normalised.toUpperCase().replace(/^(\d+[A-Z])(\d+)$/, "$1-$2");
      matched = officialIdentifiers.filter((name) => name === exact);
    } else if (/^\d+[A-Za-z]$/.test(normalised)) {
      const exact = normalised.toUpperCase();
      matched = officialIdentifiers.filter((name) => name === exact || name.startsWith(`${exact}-`));
    } else if (/^\d+-\d+$/.test(normalised)) {
      const [from, to] = normalised.split("-").map(Number);
      if (!(from < to)) throw new Error(`Malformed WMU range "${part}"`);
      for (let stem = from; stem <= to; stem += 1) matched.push(...(byStem.get(stem) ?? []));
    } else {
      throw new Error(`Unrecognised WMU token "${part}" in "${spec}"`);
    }

    if (!matched.length) throw new Error(`WMU token "${part}" in "${spec}" matches no official unit`);
    out.push(...matched);
  }

  const unique = [...new Set(out)];
  if (unique.length !== out.length) throw new Error(`WMU spec "${spec}" names a unit more than once`);
  return unique.sort();
}

export function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function zoneCanonicalId(officialIdentifier) {
  return `management_zone:ca-on-wmu-${officialIdentifier.toLowerCase()}`;
}

/**
 * Compare two generated bundles and report what a source change did to the rules.
 *
 * A moved content hash says something changed; it does not say whether a season
 * shifted, a unit moved between groups, or a footnote appeared that removes an
 * implement. A reviewer needs the second thing, because the first is not enough
 * to decide whether the change is safe to publish.
 *
 * Rules are matched by identity, not by position, so a reordered table reads as
 * no change while a genuinely different season reads as one.
 */
export function diffBundles(previous, next) {
  const groupsOf = (bundle) => new Map((bundle.groups ?? []).map((group) => [group.id, group]));
  const previousGroups = groupsOf(previous);
  const nextGroups = groupsOf(next);

  const index = (bundle, groups) =>
    new Map(
      (bundle.rules ?? []).map((rule) => [
        rule.id,
        {
          rule,
          units: groups.get(rule.regulatoryGroupId)?.officialIdentifiers ?? [],
        },
      ]),
    );
  const before = index(previous, previousGroups);
  const after = index(next, nextGroups);

  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const changed = [];

  for (const [id, entry] of after) {
    const prior = before.get(id);
    if (!prior) continue;
    const fields = [];
    const compare = (field, a, b) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) fields.push({ field, from: a, to: b });
    };
    compare("seasonPhrase", prior.rule.seasonPhrase, entry.rule.seasonPhrase);
    compare("declaredNoSeason", prior.rule.declaredNoSeason, entry.rule.declaredNoSeason);
    compare("appliesWhen", prior.rule.appliesWhen, entry.rule.appliesWhen);
    compare("limits", prior.rule.limits, entry.rule.limits);
    compare("caveats", prior.rule.caveats, entry.rule.caveats);
    compare("units", prior.units, entry.units);
    if (fields.length) changed.push({ id, speciesId: entry.rule.speciesId, units: entry.units, fields });
  }

  return { added, removed, changed };
}

/** Human-readable change report for a reviewer. */
export function formatBundleDiff({ added, removed, changed }) {
  const lines = [];
  for (const id of removed) lines.push(`  REMOVED  ${id}`);
  for (const id of added) lines.push(`  ADDED    ${id}`);
  for (const entry of changed) {
    lines.push(`  CHANGED  ${entry.id}`);
    lines.push(`           affects ${entry.units.length} unit(s): ${entry.units.slice(0, 8).join(", ")}${entry.units.length > 8 ? " …" : ""}`);
    for (const field of entry.fields) {
      const show = (value) => (typeof value === "string" ? value : JSON.stringify(value));
      lines.push(`           ${field.field}: ${show(field.from)}  ->  ${show(field.to)}`);
    }
  }
  return lines.join("\n");
}


/**
 * When this content was retrieved — which only moves when the content does.
 *
 * Stamping every build with today's date makes a rebuild differ from the
 * committed file every day, which breaks the one check that proves a bundle is
 * still what its builder produces, and a permanently red check is a check
 * nobody reads.
 *
 * It is also the more honest reading. `retrievedAt` answers "when did we fetch
 * the text these rules were built from", and re-reading an unchanged page does
 * not change that answer. "When did we last confirm it is still current" is a
 * different fact, and it lives on the source row in the database, where the
 * daily watch updates it without touching a committed file.
 */
export function retrievedAtFor(previousBundle, previousHash, currentHash, today) {
  const unchanged = previousBundle && previousHash === currentHash;
  const previousDate = previousBundle?.retrievedAt ?? previousBundle?.source?.retrievedAt;
  return unchanged && previousDate ? previousDate : today;
}

/**
 * When a quoted passage was retrieved: the previous bundle's date for the same
 * source and words while that source's text is unchanged, otherwise today.
 *
 * Stamping every quote with the build day moved the bundle's content hash on
 * every rebuild although no source had moved, so the generated-bundle check
 * went red daily. The same rule as `retrievedAtFor`, applied per quote.
 */
export function quoteRetrievedAtIndex(previousBundle) {
  const dates = new Map();
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    if (typeof value.sourceId === "string" && typeof value.quote === "string" && typeof value.retrievedAt === "string") {
      dates.set(`${value.sourceId}\u0000${value.quote}`, value.retrievedAt);
    }
    Object.values(value).forEach(visit);
  };
  visit(previousBundle);
  return (sourceId, quote, currentSourceHash, today) => {
    const unchanged = previousBundle?.sourceHashes?.[sourceId] === currentSourceHash;
    return (unchanged && dates.get(`${sourceId}\u0000${quote}`)) || today;
  };
}

/** Read a previously generated bundle, or null when there is not one yet. */
export function readPreviousBundle(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Today in the jurisdiction these sources belong to.
 *
 * UTC would stamp a bundle built on a September evening in Ontario as the 21st,
 * which is the same off-by-one-day that reached production in the Hunt page.
 * Provenance dates are calendar days like every other date in this product.
 */
export function jurisdictionToday(timeZone = "America/Toronto", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
