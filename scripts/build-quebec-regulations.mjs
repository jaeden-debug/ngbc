#!/usr/bin/env node
/**
 * Build Québec's certified regulatory bundle from the ministry's own pages.
 *
 *   node --experimental-strip-types scripts/build-quebec-regulations.mjs          # rebuild
 *   node --experimental-strip-types scripts/build-quebec-regulations.mjs --check  # fail if a source moved
 *
 * Reads the five published season pages in French, the official hunting-zone
 * layer's designations, and writes content/regulatory/ca-qc-2026.json.
 *
 * Three things make this safe to trust, and all three are enforced here rather
 * than described:
 *
 *  1. Every paragraph on every encoded page is classified. A sentence this
 *     builder has not been told about — a new footnote, a changed exclusion —
 *     stops the build with the sentence printed. Nothing a page says is ever
 *     silently left out of an answer.
 *
 *  2. Zone labels resolve only through `resolveZoneLabel`, which refuses what it
 *     cannot map to a published designation. The four labels known to be
 *     unresolvable are named below with the reason each stays refused; any other
 *     refusal stops the build.
 *
 *  3. The ministry's own prose is used to cross-check its own tables. The
 *     antlerless-moose paragraphs restate, in words, which zones and years allow
 *     antlerless moose without a permit; the builder parses both and fails if
 *     they disagree, so a table typo cannot be certified.
 *
 * `--check` exits 2 and names every rule and designation a source change
 * touches. It never rewrites the committed bundle.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  SEASON_PAGE_BASE, diffQuebecBundles, expandZoneNumberList, fetchDesignations, fetchText, formatQuebecDiff,
  implementsForEnginParagraph, implementsForHeading, lineOf, mainContent, normalise, pageBlocks, pageLastUpdated, pageTitle,
  parseClassCell, parseCrossbowBan, parseEnginCell, parseSeasonCell, seasonColumn, sha256, FIREARMS_DEFINITION,
} from "./quebec-source.mjs";
import { jurisdictionToday, readPreviousBundle, retrievedAtFor } from "./ontario-source.mjs";

/* Offline options exist for change drills: read saved pages and designations,
   write somewhere other than the committed bundle, and compare against it. A
   drill can therefore never touch production.

     --pages <dir>          read <dir>/<page>.html instead of quebec.ca
     --designations <file>  read designations from a bundle file instead of the WFS
     --out <file>           write here instead of the committed bundle
     --save-pages <dir>     after a live read, keep the exact HTML that was parsed */
const COMMITTED = "content/regulatory/ca-qc-2026.json";
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const OUTPUT = argument("--out") ?? COMMITTED;
const PAGES_DIR = argument("--pages");
const DESIGNATIONS_FILE = argument("--designations");
const SAVE_PAGES_DIR = argument("--save-pages");
const AUTHORITY =
  "Gouvernement du Québec — ministère de l'Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs";

/* The resolver and the part-name repair are the same code Hunt uses, so a label
   resolves identically at build time and in any later audit. */
const { resolveZoneLabelPartially } = await import("../src/lib/hunt/ingestion/quebec-zone-labels.ts");
const { repairPartName } = await import("../src/lib/hunt/ingestion/quebec-zone.ts");

/* ── What is read ─────────────────────────────────────────────────────────── */

const MOOSE_CLASSES = {
  "Orignal avec bois": ["ANTLERED"],
  // "tous les segments", in the ministry's own words for zones 19 sud and 29.
  "Orignal": ["ANTLERED", "ANTLERLESS"],
};

const DEER_CLASSES = {
  "Cerf de Virginie avec bois (7 cm ou plus)": ["ANTLERED"],
  "Cerf de Virginie avec ou sans bois": ["ANTLERED", "ANTLERLESS"],
  "Cerf de Virginie avec bois (norme RTLB) ou sans bois": ["ANTLERED", "ANTLERLESS"],
  "Cerf de Virginie avec bois (norme RTLB)": ["ANTLERED"],
  "Cerf de Virginie avec bois norme RTLB": ["ANTLERED"],
  "Cerf de Virginie femelle ou mâle avec bois de moins de 7 cm": ["ANTLERLESS"],
};

const TURKEY_CLASSES = {
  "Dindon sauvage porteur d'une barbe": ["BEARDED"],
  "Dindon sauvage avec ou sans barbe": ["BEARDED", "BEARDLESS"],
};

/**
 * Official class definitions, kept apart from biology on purpose.
 *
 * Québec defines antlerless moose by antler length, not by sex, so a young bull
 * with 8 cm antlers is "sans bois". Antlerless deer are "femelle ou mâle avec
 * bois de moins de 7 cm". A bearded turkey is one "porteur d'une barbe", which
 * some hens are. None of these may be read as "female" or "male".
 */
const CLASS_DEFINITIONS = {
  "species:moose": {
    dimension: "ANTLER_CLASS",
    ANTLERED: {
      officialTerm: "Orignal avec bois",
      definition: "Tout orignal dont les bois mesurent 10 cm ou plus (complément de la définition d'orignal sans bois).",
      english: "Moose with antlers 10 cm or longer",
    },
    ANTLERLESS: {
      officialTerm: "Orignal sans bois",
      definition: "Tout orignal dont les bois mesurent moins de 10 cm.",
      english: "Antlerless moose (antlers under 10 cm)",
    },
  },
  "species:white-tailed-deer": {
    dimension: "ANTLER_CLASS",
    ANTLERED: {
      officialTerm: "Cerf de Virginie avec bois (7 cm ou plus)",
      definition: "Cerf de Virginie avec bois de 7 cm ou plus.",
      english: "Deer with antlers 7 cm or longer",
    },
    ANTLERLESS: {
      officialTerm: "Cerf de Virginie femelle ou mâle avec bois de moins de 7 cm",
      definition: "Femelle, ou mâle dont les bois mesurent moins de 7 cm.",
      english: "Antlerless deer (female, or male with antlers under 7 cm)",
    },
  },
  "species:wild-turkey": {
    dimension: "BIRD_CHARACTERISTIC",
    BEARDED: {
      officialTerm: "Dindon sauvage porteur d'une barbe",
      definition: "Dindon sauvage porteur d'une barbe, quel que soit son sexe.",
      english: "Bearded turkey (of either sex)",
    },
    BEARDLESS: {
      officialTerm: "Dindon sauvage sans barbe",
      definition: "Dindon sauvage qui n'est pas porteur d'une barbe.",
      english: "Beardless turkey",
    },
  },
};

/**
 * The four labels known to be unresolvable, and only these.
 *
 * Each is recorded rather than dropped. A partially unresolvable row still
 * resolves the parts it names unambiguously (zone 29), and the fragment that
 * cannot be mapped marks the designations it can only possibly reach, so the
 * engine answers NEEDS_VERIFICATION there within the row's dates instead of
 * CLOSED. Parser failure never becomes a closure.
 */
const KNOWN_UNRESOLVED = [
  {
    page: "orignal",
    fragment: "Partie est et partie ouest de 19 sud (sauf la partie nord-ouest)",
    possiblyReaches: ["19SE", "19SO"],
    reason:
      "Coordinated ellipsis: \"partie est et partie ouest de 19 sud\" elides the tail of its first part. " +
      "Its natural reading is 19SE and 19SO, but that is an interpretation rather than a mapping, and it stays " +
      "unresolved until the ministry confirms it. The explicit exclusion of the north-west part is read, so " +
      "19SNO is not marked.",
  },
  {
    page: "ours-noir",
    fragment: "Partie est et partie ouest de 19 sud (sauf la partie nord-ouest)",
    possiblyReaches: ["19SE", "19SO"],
    reason: "Same coordinated ellipsis as the moose table.",
  },
  {
    page: "petit-gibier",
    fragment: "Île-du-Havre-Aubert",
    possiblyReaches: ["21"],
    reason:
      "The layer publishes no designation for Île-du-Havre-Aubert. The same table places the Îles-de-la-Madeleine " +
      "in zone 21, so zone 21 is marked as possibly reached.",
  },
  {
    page: "petit-gibier",
    fragment: "Dans les zones",
    possiblyReaches: [],
    reason:
      "Migratory birds: the row defers to the federal Migratory Birds Regulations, which North Ground has not " +
      "certified. The section is not encoded.",
  },
];

/* ── Pages ────────────────────────────────────────────────────────────────── */

const PAGES = [
  {
    page: "orignal",
    sourceId: "source:ca-qc-orignal-2026-2027",
    species: ["species:moose"],
    classColumn: "Segment",
    classes: MOOSE_CLASSES,
  },
  {
    page: "cerf-virginie",
    sourceId: "source:ca-qc-cerf-virginie-2026-2027",
    species: ["species:white-tailed-deer"],
    classColumn: "Âge et sexe",
    classes: DEER_CLASSES,
  },
  {
    page: "ours-noir",
    sourceId: "source:ca-qc-ours-noir-2026-2027",
    species: ["species:american-black-bear"],
  },
  {
    page: "dindon-sauvage",
    sourceId: "source:ca-qc-dindon-sauvage-2026-2027",
    species: ["species:wild-turkey"],
    classColumn: "Âge et sexe",
    classes: TURKEY_CLASSES,
  },
  {
    page: "petit-gibier",
    sourceId: "source:ca-qc-petit-gibier-2026-2028",
    /* Small game groups several species under one heading. Only these two
       groups are encoded; every other heading on the page is hashed and listed
       as not encoded, so a change to it is still seen. */
    sections: {
      "Lapin à queue blanche, lièvre arctique et lièvre d'Amérique": [
        "species:eastern-cottontail", "species:arctic-hare", "species:snowshoe-hare",
      ],
      "Gélinotte huppée, tétras du Canada et tétras à queue fine": [
        "species:ruffed-grouse", "species:spruce-grouse", "species:sharp-tailed-grouse",
      ],
    },
  },
];

/* ── Paragraph registry ───────────────────────────────────────────────────── */

/**
 * Every paragraph a page prints, and what North Ground does with it.
 *
 *   STATEMENT   a regulatory statement, kept verbatim and attached to rules
 *   CONTEXT     explanatory text that changes no answer
 *   CROSSCHECK  prose that restates the tables; parsed and compared with them
 *   NAVIGATION  links, contact details, page furniture
 *
 * Matching is by the paragraph's opening words, so a reworded paragraph still
 * matches and its change is caught by the section hash, while a new paragraph
 * matches nothing and stops the build.
 */
const PARAGRAPHS = [
  // Every page
  { starts: "Les dates de chasse sont établies en fonction", kind: "CONTEXT" },
  { starts: "Des modifications pourraient être apportées", kind: "STATEMENT", id: "modifications", scope: "page" },
  { starts: "La chasse peut être interdite dans certains territoires particuliers", kind: "STATEMENT", id: "territoires-particuliers", scope: "page" },
  { starts: "Pour savoir quoi faire avant, pendant et après", kind: "NAVIGATION" },
  { starts: "Toutes les dates de chasse", kind: "NAVIGATION" },
  { starts: "Version imprimable", kind: "NAVIGATION" },
  { starts: "Lundi, mardi, jeudi et vendredi", kind: "NAVIGATION" },
  { starts: "Mercredi :", kind: "NAVIGATION" },
  { starts: "Information réglementaire", kind: "NAVIGATION" },
  { starts: "1 877", kind: "NAVIGATION" },
  { starts: "renseignements.faune@", kind: "NAVIGATION" },
  { starts: "Dernière mise à jour", kind: "NAVIGATION" },
  { starts: "Limites de prise pour", kind: "NAVIGATION" },
  { starts: "Cartes des zones de chasse", kind: "NAVIGATION" },
  { starts: "Plan de gestion", kind: "NAVIGATION" },
  { starts: "Nouveautés pour les chasseurs", kind: "NAVIGATION" },
  { starts: "Service clientèle", kind: "NAVIGATION" },

  // Moose
  { page: "orignal", starts: "En fonction des résultats des inventaires aériens de 2021", kind: "STATEMENT", id: "zone-17-orignal", scope: "rule" },
  { page: "orignal", starts: "À compter de 2026, dans plusieurs zones", kind: "CONTEXT" },
  { page: "orignal", starts: "Dans les zones 1 à 12, 14 à 16, 22, 26 et 27", kind: "STATEMENT", id: "orignal-sans-bois-tirage", scope: "rule" },
  { page: "orignal", starts: "Dans les zones 13, 18 et 28, le système d'alternance", kind: "CROSSCHECK", id: "orignal-alternance" },
  { page: "orignal", starts: "Enfin, dans les zones 19 sud et 29", kind: "CROSSCHECK", id: "orignal-19-sud-29" },
  { page: "orignal", starts: "Le résident titulaire d'un permis de chasse à l'orignal sans bois", kind: "STATEMENT", id: "orignal-titulaire-permis", scope: "rule" },
  { page: "orignal", starts: "Durant les périodes de chasse à l'arc et à l'arbalète, il est permis de chasser l'orignal sans bois", kind: "CROSSCHECK", id: "orignal-sans-bois-arc" },
  { page: "orignal", starts: "Durant les périodes de chasse à l'arme à feu, à l'arc et à l'arbalète, il est permis de chasser l'orignal sans bois", kind: "CROSSCHECK", id: "orignal-sans-bois-armes" },
  { page: "orignal", starts: "En 2026 et 2027 :", kind: "CROSSCHECK" },
  { page: "orignal", starts: "En 2027 seulement :", kind: "CROSSCHECK" },
  { page: "orignal", starts: "Note : L'utilisation de l'arbalète est interdite", kind: "CROSSBOW" },

  // Deer
  { page: "cerf-virginie", starts: "Dans les réserves fauniques, dans certaines pourvoiries", kind: "STATEMENT", id: "cerf-territoires-structures", scope: "page" },
  { page: "cerf-virginie", starts: "Dans le territoire de Macpès (zone 2), la chasse au cerf", kind: "STATEMENT", id: "cerf-macpes", scope: "designations", designations: ["02E"] },
  { page: "cerf-virginie", starts: "Si vous chassez dans les zones 6 nord et 6 sud", kind: "STATEMENT", id: "cerf-rtlb", scope: "designations", designations: ["06N", "06S"] },
  { page: "cerf-virginie", starts: "La zone 13 sud-ouest se définit comme", kind: "STATEMENT", id: "cerf-13-sud-ouest", scope: "location", designations: ["13", "13SO"] },
  { page: "cerf-virginie", starts: "Pour la chasse au cerf de Virginie, des modalités d'exploitation particulières", kind: "STATEMENT", id: "cerf-iles", scope: "designations", designations: ["02EI", "02OI", "03EI", "03OI", "27EI", "27OI"] },
  { page: "cerf-virginie", starts: "La chasse au cerf avec ou sans bois est autorisée sur ces territoires", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Zone 2 est :", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Zone 2 ouest :", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Zone 3 est :", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Zone 27 est :", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Zone 27 ouest :", kind: "CONTEXT" },
  { page: "cerf-virginie", starts: "Ces dates sont destinées aux participants", kind: "STATEMENT", id: "cerf-releve", scope: "rule" },
  { page: "cerf-virginie", starts: "Engin :", kind: "ENGIN" },

  // Bear
  { page: "ours-noir", starts: "Dans le territoire de Macpès (zone 2), la chasse à l'ours noir", kind: "STATEMENT", id: "ours-macpes", scope: "designations", designations: ["02E"] },
  { page: "ours-noir", starts: "Un organisme gestionnaire d'une zec peut", kind: "STATEMENT", id: "ours-zecs", scope: "page" },
  { page: "ours-noir", starts: "L'utilisation de l'arbalète est interdite", kind: "CROSSBOW" },
  { page: "ours-noir", starts: "Dans les cantons de Macpès et de Duquesne (zone 2)", kind: "STATEMENT", id: "ours-macpes-duquesne", scope: "designations", designations: ["02E"] },

  // Turkey
  { page: "dindon-sauvage", starts: "Dans certaines zones, la chasse peut être interdite", kind: "STATEMENT", id: "dindon-territoires", scope: "page" },
  { page: "dindon-sauvage", starts: "La chasse est permise à partir d'une demi-heure avant le lever du soleil jusqu'à midi", kind: "STATEMENT", id: "dindon-heures", scope: "legal-time" },

  // Small game
  { page: "petit-gibier", starts: "Dans le territoire de Macpès (zone 2), la chasse au petit gibier", kind: "STATEMENT", id: "petit-gibier-macpes", scope: "designations", designations: ["02E"] },
  { page: "petit-gibier", starts: "Pour connaître les règles applicables du 1er avril 2024 au 31 mars 2026", kind: "STATEMENT", id: "petit-gibier-periode-precedente", scope: "period" },
  /* Found by this registry, not by reading: it sits outside the tables. It is
     the ministry's own statement that the Îles-de-la-Madeleine are in zone 21
     and that snowshoe hare hunting is prohibited there except for a short
     season on Île du Havre Aubert. */
  {
    page: "petit-gibier",
    starts: "Dans la zone 17, l'utilisation de collets pour prendre du lièvre",
    kind: "STATEMENT",
    id: "lievre-zone-17-iles-de-la-madeleine",
    scope: "designations",
    designations: ["17", "21"],
    species: ["species:eastern-cottontail", "species:arctic-hare", "species:snowshoe-hare"],
  },
];

function classifyParagraph(page, text) {
  const comparable = normalise(text);
  const match = PARAGRAPHS.find(
    (entry) => (!entry.page || entry.page === page) && comparable.startsWith(normalise(entry.starts)),
  );
  if (!match) throw new Error(`Unclassified paragraph on ${page}: "${text}"`);
  return match;
}

/* ── Build ────────────────────────────────────────────────────────────────── */

function slug(text) {
  return normalise(text).normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function shortHash(...parts) {
  return sha256(parts.join("")).slice("sha256:".length, "sha256:".length + 10);
}

function columnSpan(column, page) {
  /* Small game runs 1 April to 31 March: the page states the previous rules ran
     "du 1er avril 2024 au 31 mars 2026". Big game prints one calendar year per
     column. */
  if (page === "petit-gibier") {
    return { from: `${column.firstYear}-04-01`, to: `${column.lastYear}-03-31` };
  }
  return { from: `${column.firstYear}-01-01`, to: `${column.lastYear}-12-31` };
}

async function readPage(entry) {
  const url = `${SEASON_PAGE_BASE}/${entry.page}`;
  const html = PAGES_DIR ? readFileSync(`${PAGES_DIR}/${entry.page}.html`, "utf8") : await fetchText(url);
  if (SAVE_PAGES_DIR && !PAGES_DIR) writeFileSync(`${SAVE_PAGES_DIR}/${entry.page}.html`, html);
  return { ...entry, url, html };
}

function buildPage(entry, designations, context) {
  const { page, html, sourceId } = entry;
  const blocks = pageBlocks(html);
  const statements = [];
  const crosschecks = [];
  const crossbowBans = [];
  const sections = new Map();
  const rules = [];
  const unresolved = [];
  const notEncoded = [];
  let legalTime = null;
  let pendingEngin = null;
  let h2 = "";

  /* A crossbow note is a statement about zones, not about the table it happens
     to sit above: "L'utilisation de l'arbalète est interdite dans les zones 22,
     23 et 24" holds for every season in those zones. So every note on the page
     is read before any table, and applies to all of them. Applying it only to
     tables printed after it would leave the crossbow permitted in an earlier
     bow-and-crossbow table for the same zone. */
  const pageCrossbowBans = blocks
    .filter((block) => block.kind === "paragraph" && classifyParagraph(page, block.text).kind === "CROSSBOW")
    .map((block) => {
      const zones = parseCrossbowBan(block.text);
      if (!zones) throw new Error(`Unreadable crossbow note on ${page}: "${block.text}"`);
      return zones;
    });

  const sectionHash = (heading, text) => {
    const key = heading || "(top)";
    sections.set(key, (sections.get(key) ?? "") + "\n" + text);
  };

  for (const block of blocks) {
    if (block.kind === "heading") {
      if (block.heading.level <= 2) h2 = block.heading.text;
      continue;
    }
    const heading = block.heading.text;

    if (block.kind === "paragraph" || block.kind === "item") {
      sectionHash(heading, block.text);
      // The in-page table of contents and the related-links list carry no rule.
      if (/^(Dans cette page|À consulter aussi)\s*:?$/i.test(heading)) continue;
      const known = classifyParagraph(page, block.text);
      if (known.kind === "STATEMENT") {
        statements.push({
          id: `statement:ca-qc-${page}-${known.id}`,
          text: block.text,
          sourceId,
          sourceSection: heading || "(introduction)",
          scope: known.scope,
          ...(known.designations ? { designations: known.designations } : {}),
          ...(known.species ? { speciesIds: known.species } : {}),
        });
        if (known.scope === "legal-time") legalTime = block.text;
      } else if (known.kind === "CROSSCHECK") {
        crosschecks.push({ id: known.id ?? null, heading, text: block.text });
      } else if (known.kind === "CROSSBOW") {
        const zones = parseCrossbowBan(block.text);
        if (!zones) throw new Error(`Unreadable crossbow note on ${page}: "${block.text}"`);
        crossbowBans.push({ zones, text: block.text, heading });
      } else if (known.kind === "ENGIN") {
        pendingEngin = block.text.replace(/^Engin\s*:\s*/i, "").trim();
      }
      continue;
    }

    /* ── Table ── */
    const { table } = block;
    sectionHash(heading, JSON.stringify(table));

    // Which species does this table speak for, and is it encoded?
    let species = entry.species;
    if (entry.sections) {
      const sectionName = Object.keys(entry.sections).find((name) => normalise(name) === normalise(heading));
      species = sectionName ? entry.sections[sectionName] : null;
    }
    const isZec = /zecs?/i.test(h2) && /^Zec$/i.test(table.headers[0]);
    if (!species || isZec) {
      notEncoded.push({
        sourceId,
        section: isZec ? `${h2} — ${heading}` : heading,
        reason: isZec
          ? "Seasons stated per zec. North Ground does not hold zec boundaries, so these rows are recorded as a limitation on every result for this species rather than encoded against a zone."
          : "Not in the current species wave. Hashed, so a change is still detected.",
        ...(isZec ? { zecs: table.rows.map((row) => row[0].text) } : {}),
      });
      if (isZec) context.zecs.push(...table.rows.map((row) => ({ page, sourceId, section: heading, zec: row[0].text })));
      continue;
    }

    const seasonIndexes = table.headers.map((header, index) => (/Période de chasse/i.test(header) ? index : -1)).filter((index) => index >= 0);
    if (!seasonIndexes.length) throw new Error(`Table under "${heading}" on ${page} has no season column`);
    const columns = seasonIndexes.map((index) => seasonColumn(table.headers[index]));
    const classIndex = entry.classColumn ? table.headers.findIndex((header) => normalise(header) === normalise(entry.classColumn)) : -1;
    if (entry.classColumn && classIndex < 0) throw new Error(`Table under "${heading}" on ${page} has no "${entry.classColumn}" column`);
    const enginIndex = table.headers.findIndex((header) => /^Engin$/i.test(header.trim()));

    // Implements: heading (big game), engin cell (small game) or the "Engin :"
    // paragraph immediately before a relève table.
    const isReleve = /réservée à la relève/i.test(heading);
    let tableImplements = null;
    if (enginIndex < 0) {
      if (isReleve) {
        if (!pendingEngin) throw new Error(`Relève table on ${page} has no preceding "Engin :" paragraph`);
        tableImplements = implementsForEnginParagraph(pendingEngin);
        pendingEngin = null;
      } else {
        tableImplements = implementsForHeading(heading);
      }
    }

    for (const row of table.rows) {
      const label = row[0].text;
      let resolved;
      try {
        resolved = resolveZoneLabelPartially(label, designations);
      } catch (error) {
        throw new Error(`${page} / ${heading}: ${error.message}`);
      }
      for (const fragment of resolved.unresolved) {
        const known = KNOWN_UNRESOLVED.find((entryKnown) => entryKnown.page === page && normalise(fragment).startsWith(normalise(entryKnown.fragment)));
        if (!known) throw new Error(`${page} / ${heading}: unresolvable zone label fragment "${fragment}" in "${label}"`);
      }

      const engin = enginIndex >= 0 ? parseEnginCell(row[enginIndex].html) : null;
      const implementSet = engin ? engin.implements : tableImplements.implements;
      const implementLabel = engin ? engin.label : tableImplements.label;
      const rowBans = [...pageCrossbowBans, ...(engin?.note ? [parseCrossbowBan(engin.note)].filter(Boolean) : [])];
      const rowNotes = engin?.note && !parseCrossbowBan(engin.note) ? [engin.note] : [];

      const classByYear = classIndex >= 0 ? parseClassCell(row[classIndex].html, columns.map((column) => column.label)) : null;

      seasonIndexes.forEach((cellIndex, columnIndex) => {
        const column = columns[columnIndex];
        const { phrase, windows } = parseSeasonCell(row[cellIndex].html, column);
        const classLabel = classByYear ? classByYear[column.label].replace(/[’‘]/g, "'") : null;
        const animalClasses = classLabel ? entry.classes[classLabel] : null;
        if (classLabel && !animalClasses) throw new Error(`Unrecognised class "${classLabel}" on ${page}`);
        const span = columnSpan(column, page);

        const emit = (designationsForRule, permitted, partition) => {
          if (!designationsForRule.length) return;
          for (const speciesId of species) {
            /* Identity is what the row IS — its page, section, zones, implement
               and class — never its dates, so a moved date reads as a changed
               rule rather than one removed and another added. */
            const id = `regulatory_rule:ca-qc-${slug(speciesId.slice("species:".length))}-${column.label}-${shortHash(page, heading, label, implementLabel ?? "", classLabel ?? "", partition, speciesId)}`;
            rules.push({
              id,
              speciesId,
              sourceId,
              sourceSection: heading,
              zoneLabel: label,
              designations: designationsForRule,
              // Only the exclusions written against zones this rule reaches.
              caveats: resolved.scopedCaveats
                .filter((caveat) => caveat.designations.some((designation) => designationsForRule.includes(designation)))
                .map((caveat) => ({
                  text: caveat.text,
                  designations: caveat.designations.filter((designation) => designationsForRule.includes(designation)),
                })),
              implementLabel,
              permittedImplements: permitted,
              classLabel,
              animalClasses,
              seasonType: isReleve ? "RELEVE" : "REGULAR",
              seasonLabel: column.label,
              effectiveFrom: span.from,
              effectiveTo: span.to,
              seasonPhrase: phrase,
              windows,
              declaredNoSeason: false,
              notes: rowNotes,
              conditionIds: [],
              reviewStatus: "VERIFIED",
            });
          }
        };

        if (!implementSet) {
          // Turkey: the heading is carried verbatim and never mapped.
          emit(resolved.designations, null, "all");
        } else {
          /* A crossbow note subtracts the crossbow in the zones it names. Rows
             are split so each rule states exactly the implements it permits in
             exactly the designations it reaches. */
          const banned = new Set(rowBans.flat());
          const inBan = resolved.designations.filter((designation) => banned.has(designationNumber(designation, designations)));
          const outside = resolved.designations.filter((designation) => !inBan.includes(designation));
          const withoutCrossbow = implementSet.filter((implement) => implement !== "CROSSBOW");
          /* Only a row that genuinely splits gets a second identity. A row whose
             zones are all under the note keeps its own id with the crossbow
             removed, so a note gaining or losing a zone reads as a changed rule —
             "permittedImplements: CROSSBOW+BOW -> BOW" — not as one rule removed
             and another added. */
          if (!inBan.length) emit(outside, implementSet, "all");
          else if (!outside.length) emit(inBan, withoutCrossbow, "all");
          else {
            emit(outside, implementSet, "all");
            emit(inBan, withoutCrossbow, "no-crossbow");
          }
        }

        for (const fragment of resolved.unresolved) {
          const known = KNOWN_UNRESOLVED.find((entryKnown) => entryKnown.page === page && normalise(fragment).startsWith(normalise(entryKnown.fragment)));
          unresolved.push({
            sourceId,
            sourceSection: heading,
            zoneLabel: label,
            fragment,
            speciesIds: species,
            seasonLabel: column.label,
            seasonPhrase: phrase,
            windows,
            permittedImplements: implementSet,
            classLabel,
            possiblyReaches: known.possiblyReaches,
            reason: known.reason,
          });
        }
      });
    }
  }

  return {
    source: {
      id: sourceId,
      authority: AUTHORITY,
      title: pageTitle(html),
      url: entry.url,
      language: "fr",
      lastUpdated: pageLastUpdated(html),
      contentHash: sha256(lineOf(mainContent(html))),
      sections: [...sections.entries()].map(([heading, text]) => ({ heading, contentHash: sha256(text) })),
    },
    statements, crosschecks, crossbowBans, rules, unresolved, notEncoded, legalTime,
  };
}

function designationNumber(designation, designations) {
  return designations.find((entry) => entry.designation === designation)?.zoneNumber.padStart(2, "0") ?? "";
}

/* ── Cross-checks and attachments ─────────────────────────────────────────── */

/**
 * The antlerless-moose prose against the moose tables.
 *
 * The page states, in words, where antlerless moose may be taken without a
 * permit and in which years. The tables state it again through their per-year
 * segments. They must agree designation by designation, or the build stops.
 */
function crossCheckMoose(built, designations) {
  const rules = built.rules.filter((rule) => rule.speciesId === "species:moose");
  const numberOf = (designation) => designationNumber(designation, designations);
  const antlerlessOpen = (sectionPattern, year) =>
    new Set(
      rules
        .filter((rule) => sectionPattern.test(rule.sourceSection) && rule.seasonLabel === year && rule.animalClasses.includes("ANTLERLESS"))
        .flatMap((rule) => rule.designations.map(numberOf)),
    );

  const expectation = (sectionPattern, both, only2027) => {
    for (const year of ["2026", "2027"]) {
      const expected = new Set([...both, ...(year === "2027" ? only2027 : [])]);
      const actual = antlerlessOpen(sectionPattern, year);
      /* 19 sud is stated as "les parties de zones incluses dans la zone 19 sud";
         the table rows for its parts are compared as zone 19. */
      const sameSet = expected.size === actual.size && [...expected].every((zone) => actual.has(zone));
      if (!sameSet) {
        throw new Error(
          `Moose antlerless cross-check failed for ${sectionPattern} ${year}: prose says ${[...expected].sort().join(",")}, ` +
            `tables say ${[...actual].sort().join(",")}`,
        );
      }
    }
  };
  // "Durant les périodes de chasse à l'arc et à l'arbalète …": 2026 et 2027 : 13, 19 sud, 29 ; 2027 seulement : 18, 28.
  expectation(/^Périodes de chasse à l.arbalète et à l.arc$/, ["13", "19", "29"], ["18", "28"]);
  // "Durant les périodes de chasse à l'arme à feu …": 2026 et 2027 : 19 sud, 29 ; 2027 seulement : 13, 18, 28.
  expectation(/^Périodes de chasse aux armes à feu/, ["19", "29"], ["13", "18", "28"]);

  // The prose these expectations were written from must still say exactly that.
  const items = built.crosschecks.map((entry) => normalise(entry.text));
  for (const expected of [
    "en 2026 et 2027 : dans la zone 13, les parties de zones incluses dans la zone 19 sud et dans la zone 29.",
    "en 2027 seulement : dans les zones 18 et 28.",
    "en 2026 et 2027 : dans les parties de zones incluses dans la zone 19 sud et dans la zone 29.",
    "en 2027 seulement : dans les zones 13, 18 et 28.",
  ]) {
    if (!items.includes(expected)) throw new Error(`Moose cross-check prose changed; expected "${expected}"`);
  }
}

function attachStatements(built, designations, publishedNumbers) {
  const byId = new Map(built.statements.map((statement) => [statement.id.replace(/^statement:ca-qc-[a-z-]+?-(?=[a-z])/, ""), statement]));
  const statementIds = built.statements.map((statement) => statement.id);
  const locationNotes = [];

  for (const rule of built.rules) {
    for (const statement of built.statements) {
      // A statement about hare is not a statement about grouse on the same page.
      if (statement.speciesIds && !statement.speciesIds.includes(rule.speciesId)) continue;
      if (statement.sourceId !== rule.sourceId && statement.scope !== "definition") continue;
      if (statement.scope === "page") rule.conditionIds.push(statement.id);
      if (statement.scope === "designations" && rule.designations.some((designation) => statement.designations.includes(designation))) {
        rule.conditionIds.push(statement.id);
      }
      if (statement.id.endsWith("cerf-releve") && rule.seasonType === "RELEVE") rule.conditionIds.push(statement.id);
    }
  }

  /* Antlerless-moose permit regime: the zones are read from the ministry's own
     sentence, and every table rule in them must be antlered-only. */
  const permit = built.statements.find((statement) => statement.id.endsWith("orignal-sans-bois-tirage"));
  if (permit) {
    const match = /Dans les zones ([\d\sàet,]+?), ainsi que/i.exec(permit.text);
    if (!match) throw new Error(`Unreadable antlerless-permit zone list: "${permit.text}"`);
    const zones = new Set(expandZoneNumberList(match[1], publishedNumbers));
    const holder = built.statements.find((statement) => statement.id.endsWith("orignal-titulaire-permis"));
    for (const rule of built.rules.filter((entry) => entry.speciesId === "species:moose")) {
      const inRegime = rule.designations.filter((designation) => zones.has(designationNumber(designation, designations)));
      if (!inRegime.length) continue;
      if (inRegime.length !== rule.designations.length) {
        throw new Error(`Moose rule ${rule.id} straddles the antlerless-permit regime; it must be split before it can be certified.`);
      }
      if (rule.animalClasses.join() !== "ANTLERED") {
        throw new Error(`Moose rule ${rule.id} allows antlerless moose inside the drawn-permit zones: "${rule.classLabel}"`);
      }
      rule.conditionIds.push(permit.id);
      if (holder) rule.conditionIds.push(holder.id);
      rule.antlerlessByPermit = true;
    }
  }

  /* Zone 17 moose: the ministry states sport hunting is prohibited. That is a
     stated closure — CLOSED because it was said — and it is recorded with the
     rights-based harvest kept explicitly out of scope. */
  const zone17 = built.statements.find((statement) => statement.id.endsWith("zone-17-orignal"));
  if (zone17) {
    if (!/La chasse sportive est interdite/i.test(zone17.text)) {
      throw new Error("Zone 17 moose paragraph no longer states that sport hunting is prohibited.");
    }
    for (const year of ["2026", "2027"]) {
      built.rules.push({
        id: `regulatory_rule:ca-qc-moose-${year}-zone-17-chasse-sportive-interdite`,
        speciesId: "species:moose",
        sourceId: zone17.sourceId,
        sourceSection: zone17.sourceSection,
        zoneLabel: "17",
        designations: ["17"],
        caveats: [],
        implementLabel: null,
        permittedImplements: null,
        classLabel: null,
        animalClasses: null,
        seasonType: "REGULAR",
        seasonLabel: year,
        effectiveFrom: `${year}-01-01`,
        effectiveTo: `${year}-12-31`,
        seasonPhrase: null,
        windows: [],
        declaredNoSeason: true,
        notes: [],
        conditionIds: [zone17.id],
        rightsBasedHarvestExcluded: true,
        reviewStatus: "VERIFIED",
      });
    }
  }

  // Location notes: said about a place, whatever rule applies there.
  const zone13 = built.statements.find((statement) => statement.id.endsWith("cerf-13-sud-ouest"));
  if (zone13) {
    locationNotes.push({ speciesIds: ["species:white-tailed-deer"], designations: ["13", "13SO"], statementId: zone13.id });
  }
  for (const rule of built.rules) rule.conditionIds = [...new Set(rule.conditionIds)].filter((id) => statementIds.includes(id));
  void byId;
  return locationNotes;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const checkOnly = process.argv.includes("--check");

  const designations = DESIGNATIONS_FILE
    ? JSON.parse(readFileSync(DESIGNATIONS_FILE, "utf8")).designations.entries
    : await fetchDesignations(repairPartName);
  if (designations.length !== 59) {
    throw new Error(`The zone layer publishes ${designations.length} designations; this bundle was reviewed against 59.`);
  }
  const publishedNumbers = new Set(designations.map((entry) => entry.zoneNumber.padStart(2, "0")));
  const designationsHash = sha256(JSON.stringify(designations));

  // One at a time: five concurrent requests is not how to treat a government site.
  const pages = [];
  for (const entry of PAGES) pages.push(await readPage(entry));
  const context = { zecs: [] };
  const builtPages = pages.map((page) => buildPage(page, designations, context));

  const merged = {
    sources: builtPages.map((built) => built.source),
    statements: builtPages.flatMap((built) => built.statements),
    crosschecks: builtPages.flatMap((built) => built.crosschecks),
    rules: builtPages.flatMap((built) => built.rules),
    unresolved: builtPages.flatMap((built) => built.unresolved),
    notEncoded: builtPages.flatMap((built) => built.notEncoded),
  };

  crossCheckMoose({ rules: merged.rules, crosschecks: builtPages[0].crosschecks }, designations);
  const locationNotes = attachStatements(merged, designations, publishedNumbers);

  // Rule identity must be unique, or two rows would overwrite each other.
  const ids = new Set();
  for (const rule of merged.rules) {
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
    ids.add(rule.id);
  }

  merged.rules.sort((a, b) => a.id.localeCompare(b.id));
  merged.statements.push({
    id: "statement:ca-qc-definition-armes-a-feu",
    text: FIREARMS_DEFINITION,
    sourceId: "source:ca-qc-cerf-virginie-2026-2027",
    sourceSection: "Périodes de chasse aux armes à feu (carabine, fusil, arme à chargement par la bouche), à l'arbalète et à l'arc",
    scope: "definition",
  });

  const legalTimes = Object.fromEntries(
    builtPages.filter((built) => built.legalTime).map((built) => [built.source.id, built.legalTime]),
  );

  const contentHash = sha256(
    JSON.stringify({
      designationsHash,
      sources: merged.sources.map((source) => [source.id, source.contentHash]),
    }),
  );
  // Always compared with the committed bundle, even when writing elsewhere.
  const previous = readPreviousBundle(COMMITTED);
  const today = jurisdictionToday("America/Toronto");

  const bundle = {
    contractVersion: 1,
    bundleId: "bundle:ca-qc-2026",
    jurisdictionId: "jurisdiction:ca-qc",
    authority: AUTHORITY,
    language: "fr",
    retrievedAt: retrievedAtFor(previous, previous?.contentHash, contentHash, today),
    contentHash,
    certifiedPeriods: {
      /* The big-game pages are titled 2026-2027 and print one column per year.
         Small game states its previous rules ran to 31 March 2026, so the
         current page speaks from 1 April 2026. */
      bigGame: { from: "2026-01-01", to: "2027-12-31" },
      smallGame: {
        from: smallGamePeriodStart(merged.statements),
        to: maxClose(merged.rules.filter((rule) => rule.sourceId.includes("petit-gibier"))),
      },
    },
    designations: {
      source: "SmartFaunePub:Zone_chasse_da3_sefaq",
      count: designations.length,
      contentHash: designationsHash,
      entries: designations,
    },
    classDefinitions: CLASS_DEFINITIONS,
    legalTime: legalTimes,
    zecs: context.zecs,
    locationNotes,
    ...merged,
  };
  delete bundle.crosschecks;

  const serialized = `${JSON.stringify(bundle, null, 2)}\n`;

  if (checkOnly) {
    if (!previous) {
      console.error(`No committed bundle at ${OUTPUT}; run without --check first.`);
      process.exit(1);
    }
    if (previous.contentHash === contentHash) {
      /* Unchanged sources must also mean an unchanged bundle. If the builder's
         reading of the same pages has moved, the committed file is no longer
         what this code produces, and that is its own finding. */
      const committed = readFileSync(COMMITTED, "utf8");
      if (committed !== serialized) {
        console.error("Québec sources are unchanged, but the builder no longer produces the committed bundle.");
        console.error(formatQuebecDiff(diffQuebecBundles(previous, bundle)));
        console.error("Rebuild without --check and review the diff before committing it.");
        process.exit(3);
      }
      console.log(`Québec sources unchanged and bundle reproduces byte for byte (${contentHash}).`);
      return;
    }
    console.error("An official Québec source has CHANGED since the bundle was built.");
    const before = new Map((previous.sources ?? []).map((source) => [source.id, source]));
    for (const source of bundle.sources) {
      const prior = before.get(source.id);
      if (!prior || prior.contentHash !== source.contentHash) {
        console.error(`  MOVED  ${source.id} (page updated ${source.lastUpdated})`);
        const priorSections = new Map((prior?.sections ?? []).map((section) => [section.heading, section.contentHash]));
        for (const section of source.sections) {
          if (priorSections.get(section.heading) !== section.contentHash) console.error(`         section: ${section.heading}`);
        }
      }
    }
    if (previous.designations?.contentHash !== designationsHash) console.error("  MOVED  zone designations");
    console.error(formatQuebecDiff(diffQuebecBundles(previous, bundle)));
    console.error("Review the change against the source, then rebuild without --check.");
    process.exit(2);
  }

  writeFileSync(OUTPUT, serialized);
  const bySpecies = new Map();
  for (const rule of bundle.rules) bySpecies.set(rule.speciesId, (bySpecies.get(rule.speciesId) ?? 0) + 1);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${bundle.rules.length} rules, ${bundle.statements.length} statements, ${bundle.unresolved.length} unresolved fragments, ${bundle.notEncoded.length} sections not encoded`);
  for (const [speciesId, count] of [...bySpecies.entries()].sort()) console.log(`  ${speciesId.padEnd(32)} ${count}`);
  console.log(`  content hash ${contentHash}`);
}

/**
 * The first day the current small-game rules speak for.
 *
 * The page says the previous rules applied "du 1er avril 2024 au 31 mars 2026".
 * The day after that period is the first the current page can answer for; any
 * earlier date belongs to a document North Ground has not certified.
 */
function smallGamePeriodStart(statements) {
  const statement = statements.find((entry) => entry.id.endsWith("petit-gibier-periode-precedente"));
  const match = statement && /au (\d{1,2})(?:er)? mars (\d{4})/i.exec(statement.text);
  if (!match || match[1] !== "31") throw new Error("Small-game previous-period sentence no longer ends on 31 March.");
  return `${match[2]}-04-01`;
}

function maxClose(rules) {
  return rules.flatMap((rule) => rule.windows.map((window) => window.closes)).sort().at(-1) ?? null;
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
