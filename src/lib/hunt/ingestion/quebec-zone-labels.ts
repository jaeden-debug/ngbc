/**
 * Reading Québec's published zone labels against Québec's published geometry.
 *
 * The season tables and the GIS layer name the same places differently. A table
 * says "1, 2 (sauf les cantons de Macpès et Duquesne), 3, 4"; the layer says
 * 01N, 01S, 02E, 02EI, 02O, 02OI, 03E … Every Québec rule depends on getting
 * that correspondence right, and getting it wrong is silent: a rule attached to
 * one designation too many reads as a season in a place that has none.
 *
 * So this resolves only what the evidence supports and refuses the rest. A label
 * it cannot read raises, which stops a build; it never resolves to a plausible
 * guess. Coordinated prose like "Partie est et partie ouest de 19 sud" is left
 * refusing on purpose — distributing an elided tail is the point where a parser
 * starts inventing, and a bundle can carry that mapping explicitly, with its
 * evidence, where a reviewer can see it.
 *
 * The forms it does read are each grounded in something the authority published:
 *
 * 1. A bare number is every part of that number. The small-game table writes
 *    "2 (sauf l'Île Verte)", treating zone 2 as including its islands and
 *    removing one by name, so the number alone is the whole zone.
 *
 * 2. A number with a cardinal part means that part and its cardinal
 *    subdivisions. "13 sud-ouest" is 13SO exactly; "19 sud" is 19SE, 19SO and
 *    19SNO, because zone 19 publishes no part named plainly "Sud".
 *
 * 3. A part whose name continues into a territory rather than a direction —
 *    "Nord ZSR", "Nord (Montagne de Rigaud)", "Est (Seigneurie de Beaupré)" —
 *    is never swept into its parent. Those are places with their own regime,
 *    not finer compass divisions. ZSR is the enhanced surveillance zone for
 *    chronic wasting disease, whose measures no season table states, and the
 *    deer table gives Montagne de Rigaud a row of its own while excluding it
 *    from "8 nord". Reading either as part of its parent would answer for
 *    ground the source never spoke about. The layer's own punctuation carries
 *    the distinction, so the rule is mechanical: a hyphen continues a
 *    direction, a space or a bracket introduces a territory.
 *
 * 4. The three prose forms the tables use to name those territories back —
 *    "Partie est de 19 sud", "Territoire de la montagne de Rigaud dans la zone
 *    8 nord", and the St Lawrence islands "compris dans les zones 2 est, …" —
 *    each resolve by composing the part name the layer would have to publish,
 *    and refuse when it does not publish it.
 */

/** A designation as the layer publishes it, e.g. 19SE with part "Sud-Est". */
export interface ZoneDesignation {
  /** The layer's `Zone` attribute: "01N", "19SE", "08NMR". */
  designation: string;
  /** The layer's `No_zone` attribute, as written: "01", "19", "08". */
  zoneNumber: string;
  /** The layer's repaired `Partie_zon`: "Nord", "Sud-Est", "Nord ZSR", "". */
  partName: string;
}

export interface ResolvedZoneLabel {
  /** Designations the label reaches, sorted, never empty when it resolves. */
  designations: string[];
  /**
   * Text the authority attached to this label that the geometry cannot express,
   * verbatim and in French.
   *
   * "sauf les cantons de Macpès et Duquesne" narrows a season to less than the
   * zone it names, and no boundary here draws a township. Carrying the phrase
   * forward is the difference between a hunter reading the authority's own
   * limit and reading a season that appears to cover ground it does not.
   */
  caveats: string[];
  /**
   * The same caveats, each with the designations of the fragment it was
   * written against. "Partie ouest de 19 sud (sauf la partie nord-ouest), 29"
   * excludes a part of zone 19, and saying so to a hunter in zone 29 would be a
   * statement about somewhere else.
   */
  scopedCaveats: Array<{ text: string; designations: string[] }>;
}

export class UnreadableZoneLabel extends Error {
  /** The whole published cell, so a reviewer sees it as the authority wrote it. */
  readonly label: string;
  /** The one fragment that could not be read. */
  readonly part: string;

  constructor(label: string, part: string, reason: string) {
    super(`Unreadable Québec zone label ${JSON.stringify(part)} in ${JSON.stringify(label)}: ${reason}`);
    this.name = "UnreadableZoneLabel";
    this.label = label;
    this.part = part;
  }
}

/** Lower-cased and accent-folded, so "Sud-Est" and "sud-est" compare equal. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Split on a separator, leaving anything inside brackets alone.
 *
 * The exclusions the authority writes contain their own commas and "et" —
 * "(sauf les cantons de Macpès, de Duquesne et l'ensemble des îles …)" — so a
 * naive split tears one limit into fragments and loses it.
 */
function splitOutsideBrackets(value: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const match = separator.exec(value.slice(index));
      if (match?.index === 0) {
        parts.push(current);
        current = "";
        index += match[0].length - 1;
        continue;
      }
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** The parenthesised exclusion, if the fragment carries one, and the text before it. */
function takeExclusion(part: string): { head: string; caveat: string | null } {
  const match = /^(.*?)\s*\((\s*(?:sauf|excluant|except)\b[\s\S]*)\)\s*$/i.exec(part);
  if (!match) return { head: part.trim(), caveat: null };
  return { head: match[1].trim(), caveat: match[2].trim() };
}

function ofNumber(designations: readonly ZoneDesignation[], digits: string): ZoneDesignation[] {
  const number = digits.padStart(2, "0");
  return designations.filter((entry) => entry.zoneNumber.padStart(2, "0") === number);
}

function published(entries: readonly ZoneDesignation[]): string {
  return entries.map((entry) => entry.partName || "(whole)").join(", ");
}

/**
 * Designations of one zone number whose part is exactly `wanted`.
 *
 * Used by the composing forms, which know the part name the layer would have to
 * publish and must refuse rather than settle for a near miss.
 */
function withExactPart(entries: readonly ZoneDesignation[], wanted: string): ZoneDesignation[] {
  return entries.filter((entry) => fold(entry.partName) === fold(wanted));
}

/**
 * "Ensemble des îles et îlots du fleuve Saint-Laurent … compris dans les zones
 * 2 est, 2 ouest, 3 est, 3 ouest, 27 est, 27 ouest".
 *
 * The layer publishes each of those six as its own designation, with the parent
 * part decorated "(Île)": 02EI, 02OI, 03EI, 03OI, 27EI, 27OI. The row names the
 * islands and the layer draws them, so this is a correspondence rather than an
 * interpretation — but it is still checked one by one, and refuses if the layer
 * stops publishing any of them.
 */
function resolveStLawrenceIslands(
  label: string,
  designations: readonly ZoneDesignation[],
): string[] | null {
  const match = /compris\s+dans\s+les\s+zones\s+(.+)$/i.exec(label);
  if (!match || !/^ensemble\s+des\s+[îi]les/i.test(label.trim())) return null;

  const reached: string[] = [];
  for (const fragment of splitOutsideBrackets(match[1], /^\s*,\s*|^\s+et\s+/)) {
    const zone = /^(\d{1,2})\s+(\S+)$/.exec(fragment.trim());
    if (!zone) throw new UnreadableZoneLabel(label, fragment, "is not a zone and part");
    const found = withExactPart(ofNumber(designations, zone[1]), `${zone[2]} (Île)`);
    if (!found.length) {
      throw new UnreadableZoneLabel(label, fragment, `the layer publishes no island part for zone ${zone[1]} ${zone[2]}`);
    }
    reached.push(...found.map((entry) => entry.designation));
  }
  return reached;
}

/**
 * "Territoire de la montagne de Rigaud dans la zone 8 nord" — a named territory
 * inside a part, which the layer publishes as "Nord (Montagne de Rigaud)".
 */
function resolveNamedTerritory(
  label: string,
  fragment: string,
  designations: readonly ZoneDesignation[],
): string[] | null {
  const match = /^territoire\s+(?:de\s+la\s+|de\s+l['’]|du\s+|de\s+|des\s+)?(.+?)\s+dans\s+la\s+zone\s+(\d{1,2})\s*(.*)$/i
    .exec(fragment);
  if (!match) return null;

  const [, territory, digits, parentPart] = match;
  const entries = ofNumber(designations, digits);
  const wanted = `${parentPart.trim()} (${territory.trim()})`;
  const found = withExactPart(entries, wanted);
  if (!found.length) {
    throw new UnreadableZoneLabel(
      label,
      fragment,
      `zone ${digits} publishes no part named ${JSON.stringify(wanted)} (it publishes ${published(entries)})`,
    );
  }
  return found.map((entry) => entry.designation);
}

/**
 * "Partie est de 19 sud" — a direction inside a part, which the layer publishes
 * as the parent part hyphenated with that direction: "Sud-Est".
 *
 * Composed and then checked, so "partie ouest de 19 sud" reaches 19SO and not
 * 19SNO: "Sud-Nord-Ouest" is not "Sud-Ouest".
 */
function resolveSubPart(
  label: string,
  fragment: string,
  designations: readonly ZoneDesignation[],
): string[] | null {
  const match = /^partie\s+([a-zà-ÿ-]+)\s+de\s+(?:la\s+zone\s+)?(\d{1,2})\s*(.*)$/i.exec(fragment);
  if (!match) return null;

  const [, direction, digits, parentPart] = match;
  const entries = ofNumber(designations, digits);
  const wanted = parentPart.trim() ? `${parentPart.trim()}-${direction}` : direction;
  const found = withExactPart(entries, wanted);
  if (!found.length) {
    throw new UnreadableZoneLabel(
      label,
      fragment,
      `zone ${digits} publishes no part named ${JSON.stringify(wanted)} (it publishes ${published(entries)})`,
    );
  }
  return found.map((entry) => entry.designation);
}

/**
 * A part whose name continues into a territory rather than a direction.
 *
 * "Sud-Est" subdivides Sud. "Nord ZSR" and "Nord (Montagne de Rigaud)" do not
 * subdivide Nord; they name particular ground inside it. Only the hyphen
 * continues a compass reading.
 */
function isCardinalExtension(partFolded: string, cardinalFolded: string): boolean {
  return partFolded === cardinalFolded || partFolded.startsWith(`${cardinalFolded}-`);
}

function resolveNumbered(
  label: string,
  fragment: string,
  designations: readonly ZoneDesignation[],
): string[] | null {
  const match = /^(\d{1,2})\s*(.*)$/.exec(fragment);
  if (!match) return null;

  const [, digits, remainder] = match;
  const entries = ofNumber(designations, digits);
  if (!entries.length) {
    throw new UnreadableZoneLabel(label, fragment, `no designation carries zone number ${digits}`);
  }

  const cardinal = fold(remainder);
  /* Rule 1: the number alone is the whole zone, territories included. The
     authority removes territories by naming them, not by omitting them. */
  if (!cardinal) return entries.map((entry) => entry.designation);

  /* Rules 2 and 3: a cardinal part reaches its own subdivisions and stops at
     any part that names a territory instead of a direction. */
  const matched = entries.filter((entry) => isCardinalExtension(fold(entry.partName), cardinal));
  if (!matched.length) {
    throw new UnreadableZoneLabel(
      label,
      fragment,
      `zone ${digits} publishes no part named ${JSON.stringify(remainder.trim())} (it publishes ${published(entries)})`,
    );
  }
  return matched.map((entry) => entry.designation);
}

/** One comma-separated fragment, resolved completely or not at all. */
function resolveFragment(
  label: string,
  commaFragment: string,
  designations: readonly ZoneDesignation[],
): { designations: string[]; caveats: Array<{ text: string; designations: string[] }> } {
  const applyFragment = (rawFragment: string): { designations: string[]; caveat: string | null } => {
    const { head, caveat } = takeExclusion(rawFragment);
    const found =
      resolveNamedTerritory(label, head, designations) ??
      resolveSubPart(label, head, designations) ??
      resolveNumbered(label, head, designations);
    if (!found) throw new UnreadableZoneLabel(label, rawFragment, "does not name a zone");
    return { designations: found, caveat };
  };

  /* "1 sud et 2 est" is two zones; "Partie est et partie ouest de 19 sud"
     elides its tail and is not split apart, so the fragment is tried whole first
     and only then as a coordination in which EVERY part must resolve. A
     coordination that half-resolves is refused as a unit: resolving "partie
     ouest de 19 sud" out of it would attach a season to a part the row may not
     have meant on its own. */
  try {
    const whole = applyFragment(commaFragment);
    return {
      designations: whole.designations,
      caveats: whole.caveat ? [{ text: whole.caveat, designations: whole.designations }] : [],
    };
  } catch (error) {
    if (!(error instanceof UnreadableZoneLabel)) throw error;
    const parts = splitOutsideBrackets(commaFragment, /^\s+et\s+/);
    if (parts.length < 2) throw error;
    const resolvedParts = parts.map(applyFragment);
    return {
      designations: resolvedParts.flatMap((part) => part.designations),
      caveats: resolvedParts.flatMap((part) => (part.caveat ? [{ text: part.caveat, designations: part.designations }] : [])),
    };
  }
}

/**
 * Resolve one published zone label against the layer's designations.
 *
 * Raises `UnreadableZoneLabel` rather than returning a partial answer. A label
 * this cannot read is a label a person has to look at, and the build stops until
 * they have.
 */
export function resolveZoneLabel(label: string, designations: readonly ZoneDesignation[]): ResolvedZoneLabel {
  const result = resolveZoneLabelPartially(label, designations);
  if (result.unresolved.length) {
    // Re-run the first failure to raise its own, specific refusal.
    resolveFragment(label, result.unresolved[0], designations);
  }
  return { designations: result.designations, caveats: result.caveats, scopedCaveats: result.scopedCaveats };
}

export interface PartiallyResolvedZoneLabel extends ResolvedZoneLabel {
  /** Comma-separated fragments that could not be mapped, verbatim, in order. */
  unresolved: string[];
}

/**
 * Resolve what a label names unambiguously and return the rest verbatim.
 *
 * "Partie est et partie ouest de 19 sud (sauf la partie nord-ouest), 29" names
 * zone 29 without any doubt; the first fragment is the one that cannot be
 * mapped. A regulatory build uses this to certify zone 29 while recording the
 * fragment — never to guess at it. Whether an unresolved fragment is acceptable
 * at all is the caller's decision, made against a reviewed list.
 */
export function resolveZoneLabelPartially(
  label: string,
  designations: readonly ZoneDesignation[],
): PartiallyResolvedZoneLabel {
  /* Tried whole, before any splitting: this form spells out its own list of
     zones, with commas and an "et" that a split would cut through. */
  const islands = resolveStLawrenceIslands(label, designations);
  if (islands) return { designations: [...new Set(islands)].sort(), caveats: [], scopedCaveats: [], unresolved: [] };

  const reached = new Set<string>();
  const scopedCaveats: Array<{ text: string; designations: string[] }> = [];
  const unresolved: string[] = [];
  for (const commaFragment of splitOutsideBrackets(label, /^\s*,\s*/)) {
    try {
      const fragment = resolveFragment(label, commaFragment, designations);
      for (const designation of fragment.designations) reached.add(designation);
      scopedCaveats.push(...fragment.caveats.map((caveat) => ({ ...caveat, designations: [...caveat.designations].sort() })));
    } catch (error) {
      if (!(error instanceof UnreadableZoneLabel)) throw error;
      unresolved.push(commaFragment);
    }
  }
  return {
    designations: [...reached].sort(),
    caveats: scopedCaveats.map((caveat) => caveat.text),
    scopedCaveats,
    unresolved,
  };
}

/** Exposed so the bracket-aware splitting is asserted directly, not only through a label. */
export const splitOutsideBracketsForTest = splitOutsideBrackets;
