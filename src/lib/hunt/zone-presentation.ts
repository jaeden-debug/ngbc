/**
 * How a management zone is SHOWN, kept apart from what it IS.
 *
 *   canonical id        management_zone:ca-qc-zone-10o   — joins, rules, provenance
 *   source designation  10O                              — the authority's own code
 *   official name       Zone de chasse 10O               — the authority's own name
 *   full label          Zone 10 West / Zone 10 Ouest     — cards, results, briefs
 *   designation label   10 West / 10 Ouest               — readable, without the term
 *   compact label       10W / 10O                        — map polygons, tight UI
 *
 * Only the first three are identity. Labels are derived, per locale, from the
 * designation and never flow back: nothing may join, look up a rule, key a
 * feature or record provenance by a label. Changing locale therefore cannot
 * change a polygon, a zone, a rule, a season or a status — it only changes words.
 *
 * Presentation is data, one profile per jurisdiction's zone layer. A new
 * jurisdiction (BC MU, Saskatchewan WMZ, a U.S. GMU) adds a row here rather than
 * a branch in a component. A jurisdiction without a row is presented as its raw
 * designation with status UNSUPPORTED_JURISDICTION: never an invented name.
 *
 * Localisation follows the authority. A term or direction is translated only
 * where the authority publishes that language; otherwise the authority's own
 * term is kept and `localized` is false. Proper names (Montagne de Rigaud,
 * Seigneurie de Beaupré) are never translated. A suffix whose meaning is not
 * unambiguous (Québec's 19SNO) keeps its source code rather than gaining an
 * expansion the authority never wrote.
 *
 * This module is dependency-free so the browser, the server and the Hunt Brief
 * can all call it. `zone-presentation.test.ts` holds its profiles against
 * `ZONE_LAYERS` and against every certified production designation.
 */

export const ZONE_LOCALES = ["en-CA", "fr-CA"] as const;
export type ZoneLocale = (typeof ZONE_LOCALES)[number];
export const DEFAULT_ZONE_LOCALE: ZoneLocale = "en-CA";

export function isZoneLocale(value: unknown): value is ZoneLocale {
  return typeof value === "string" && (ZONE_LOCALES as readonly string[]).includes(value);
}

type Localized<T> = Partial<Record<ZoneLocale, T>>;

interface ZoneTerm {
  /** "Wildlife Management Unit", "Zone de chasse". */
  long: string;
  /** What precedes a designation in a label: "WMU", "GHA", "Zone". */
  short: string;
}

/** A compass part the authority writes as a code ("O" = Ouest). */
interface DirectionEntry {
  /** The code as it appears in the source designation. */
  sourceCode: string;
  /** Word and compact code per locale. Absent locale ⇒ keep the source code. */
  words: Localized<{ word: string; code: string }>;
}

/**
 * A part that continues a direction into a territory or special regime. The
 * text is the authority's own part name, kept verbatim in every locale.
 */
interface QualifierEntry {
  sourceCode: string;
  /** Appended to the full label exactly as the authority writes it. */
  text: string;
}

export interface ZonePresentationProfile {
  layerId: string;
  jurisdictionId: string;
  /** Prefix of the canonical ids this layer mints (mirrors `ZoneLayer.zoneIdPrefix`). */
  zoneIdPrefix: string;
  /** Prefix of the authority's official name (mirrors `ZoneLayer.officialNamePrefix`). */
  officialNamePrefix: string;
  /** The language the authority publishes designations in. */
  sourceLocale: ZoneLocale;
  jurisdictionName: Localized<string> & { [DEFAULT_ZONE_LOCALE]: string };
  /** Terms per locale. Only locales the authority itself publishes. */
  term: Localized<ZoneTerm> & Record<ZoneLocale, ZoneTerm | undefined>;
  /**
   * Whether `term.short` is an abbreviation ("WMU", "GHA") that a screen reader
   * should hear spelled out, rather than a word ("Zone").
   */
  termIsAbbreviation: boolean;
  /** Designations this authority publishes. Anything else is presented raw. */
  designationPattern: RegExp;
  /** Zero-padded numbers ("01N") read as numbers in labels ("Zone 1 North"). */
  stripLeadingZeros: boolean;
  /**
   * Trailing codes that are compass directions. Letters not listed here (Ontario
   * 11A, Manitoba 13A, 69A-1) are subdivision letters and are never expanded.
   */
  directions?: readonly DirectionEntry[];
  /** Codes that may follow a direction, naming a territory rather than a direction. */
  qualifiers?: readonly QualifierEntry[];
  /** Designations whose suffix is deliberately left unexpanded, with the reason. */
  preserved?: Readonly<Record<string, string>>;
  /**
   * Designations the authority publishes as a proper name rather than a number,
   * written exactly as the authority writes them. The name already carries the
   * term ("Saskatoon WMZ"), so the `term` template is not applied on top of it
   * and nothing is translated. The map still labels these with the code.
   */
  properNames?: Readonly<Record<string, Localized<string>>>;
}

/** Québec's compass codes, from the ministry's `Partie_zon` values. */
const QUEBEC_DIRECTIONS: readonly DirectionEntry[] = [
  // Longest first, so "SE" is not read as "S" + "E".
  { sourceCode: "SE", words: { "en-CA": { word: "Southeast", code: "SE" }, "fr-CA": { word: "Sud-Est", code: "SE" } } },
  { sourceCode: "SO", words: { "en-CA": { word: "Southwest", code: "SW" }, "fr-CA": { word: "Sud-Ouest", code: "SO" } } },
  { sourceCode: "N", words: { "en-CA": { word: "North", code: "N" }, "fr-CA": { word: "Nord", code: "N" } } },
  { sourceCode: "S", words: { "en-CA": { word: "South", code: "S" }, "fr-CA": { word: "Sud", code: "S" } } },
  { sourceCode: "E", words: { "en-CA": { word: "East", code: "E" }, "fr-CA": { word: "Est", code: "E" } } },
  { sourceCode: "O", words: { "en-CA": { word: "West", code: "W" }, "fr-CA": { word: "Ouest", code: "O" } } },
];

export const ZONE_PRESENTATION_PROFILES: readonly ZonePresentationProfile[] = [
  {
    layerId: "layer:ca-on-wmu",
    jurisdictionId: "jurisdiction:ca-on",
    zoneIdPrefix: "management_zone:ca-on-wmu-",
    officialNamePrefix: "Wildlife Management Unit ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Ontario", "fr-CA": "Ontario" },
    // No French term is recorded from Ontario's own publications yet; the
    // authority's English term is kept in French rather than translated.
    term: { "en-CA": { long: "Wildlife Management Unit", short: "WMU" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    // 57, 11A, 76E, 69A-1: the letters and hyphenated part are subdivisions.
    designationPattern: /^\d{1,2}[A-E]?(-\d)?$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-mb-gha",
    jurisdictionId: "jurisdiction:ca-mb",
    zoneIdPrefix: "management_zone:ca-mb-gha-",
    officialNamePrefix: "Game Hunting Area ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Manitoba", "fr-CA": "Manitoba" },
    term: { "en-CA": { long: "Game Hunting Area", short: "GHA" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{1,2}[A-C]?$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-ab-wmu",
    jurisdictionId: "jurisdiction:ca-ab",
    zoneIdPrefix: "management_zone:ca-ab-wmu-",
    officialNamePrefix: "Wildlife Management Unit ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Alberta", "fr-CA": "Alberta" },
    term: { "en-CA": { long: "Wildlife Management Unit", short: "WMU" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{3}$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-qc-zone-chasse",
    jurisdictionId: "jurisdiction:ca-qc",
    zoneIdPrefix: "management_zone:ca-qc-zone-",
    officialNamePrefix: "Zone de chasse ",
    sourceLocale: "fr-CA",
    jurisdictionName: { "en-CA": "Québec", "fr-CA": "Québec" },
    term: {
      "en-CA": { long: "Hunting zone", short: "Zone" },
      "fr-CA": { long: "Zone de chasse", short: "Zone" },
    },
    termIsAbbreviation: false,
    // Only the suffixes the ministry publishes (content/regulatory/ca-qc-zone-layer.json);
    // "10W" is not a Québec zone and must not look like one.
    designationPattern: /^\d{2}(N|S|E|O|SE|SO|SNO|EI|OI|NMR|NZ|OZ|EZ|ESB|OSB)?$/,
    stripLeadingZeros: true,
    directions: QUEBEC_DIRECTIONS,
    // The ministry's own part names (docs/quebec-regulatory-sources.md §2).
    qualifiers: [
      { sourceCode: "MR", text: "(Montagne de Rigaud)" },
      { sourceCode: "SB", text: "(Seigneurie de Beaupré)" },
      { sourceCode: "Z", text: "ZSR" },
      { sourceCode: "I", text: "(Île)" },
    ],
    preserved: {
      // "Sud-Nord-Ouest" is a part of Sud, not a compass point; "South-Northwest"
      // would be an expansion the ministry never wrote, and it is not Sud-Ouest.
      "19SNO": "Part name « Sud-Nord-Ouest » has no unambiguous compass reading.",
    },
  },
  {
    layerId: "layer:ca-bc-mu",
    jurisdictionId: "jurisdiction:ca-bc",
    zoneIdPrefix: "management_zone:ca-bc-mu-",
    officialNamePrefix: "Management Unit ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "British Columbia", "fr-CA": "Colombie-Britannique" },
    // B.C. Reg. 64/96 publishes the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Management Unit", short: "MU" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    // "<region>-<number>" (7-15): the hyphen belongs to the designation, and the
    // regulation reads "-01" as "-1" (s. 3), so no zero-padded form is published.
    designationPattern: /^[1-8]-[1-9]\d?$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-yt-gms",
    jurisdictionId: "jurisdiction:ca-yt",
    zoneIdPrefix: "management_zone:ca-yt-gms-",
    officialNamePrefix: "Game Management Subzone ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Yukon", "fr-CA": "Yukon" },
    // The Wildlife Act publishes the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Game Management Subzone", short: "GMS" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    // "<zone>-<subzone>", the subzone padded to two digits as Yukon writes it (4-17).
    designationPattern: /^(?:[1-9]|1[01])-\d{2}$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-nl-moose-area",
    jurisdictionId: "jurisdiction:ca-nl",
    zoneIdPrefix: "management_zone:ca-nl-mma-",
    officialNamePrefix: "Moose Management Area ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Newfoundland and Labrador", "fr-CA": "Terre-Neuve-et-Labrador" },
    // The Wild Life Regulations publish the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Moose Management Area", short: "MMA" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{3}[A-Z]?$/,
    // The Wildlife Division's own designation is padded to three digits ("044"),
    // and it is shown as the province writes it.
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-nl-caribou-area",
    jurisdictionId: "jurisdiction:ca-nl",
    zoneIdPrefix: "management_zone:ca-nl-cma-",
    officialNamePrefix: "Caribou Management Area ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Newfoundland and Labrador", "fr-CA": "Terre-Neuve-et-Labrador" },
    // The Wild Life Regulations publish the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Caribou Management Area", short: "CMA" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{3}$/,
    // The Wildlife Division's own designation is padded to three digits ("044"),
    // and it is shown as the province writes it.
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-nl-bear-area",
    jurisdictionId: "jurisdiction:ca-nl",
    zoneIdPrefix: "management_zone:ca-nl-bma-",
    officialNamePrefix: "Black Bear Management Area ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Newfoundland and Labrador", "fr-CA": "Terre-Neuve-et-Labrador" },
    // The Wild Life Regulations publish the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Black Bear Management Area", short: "BMA" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^2\d{2}$/,
    // The Wildlife Division's own designation is padded to three digits ("044"),
    // and it is shown as the province writes it.
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-nb-wmz",
    jurisdictionId: "jurisdiction:ca-nb",
    zoneIdPrefix: "management_zone:ca-nb-wmz-",
    officialNamePrefix: "Wildlife Management Zone ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "New Brunswick", "fr-CA": "Nouveau-Brunswick" },
    /* New Brunswick is officially bilingual and publishes the term in both, so
       both are the authority's own words rather than a translation. */
    term: {
      "en-CA": { long: "Wildlife Management Zone", short: "WMZ" },
      "fr-CA": { long: "Zone d'aménagement de la faune", short: "ZAF" },
    },
    termIsAbbreviation: true,
    // 1 to 27, as the regulation numbers them.
    designationPattern: /^([1-9]|1\d|2[0-7])$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-ns-deer-zone",
    jurisdictionId: "jurisdiction:ca-ns",
    zoneIdPrefix: "management_zone:ca-ns-dmz-",
    officialNamePrefix: "Deer Management Zone ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Nova Scotia", "fr-CA": "Nouvelle-Écosse" },
    // The province publishes the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Deer Management Zone", short: "DMZ" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    // Twelve zones, 101 to 112, as the regulation numbers them.
    designationPattern: /^1(0[1-9]|1[0-2])$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:ca-sk-wmz",
    jurisdictionId: "jurisdiction:ca-sk",
    zoneIdPrefix: "management_zone:ca-sk-wmz-",
    officialNamePrefix: "Wildlife Management Zone ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Saskatchewan", "fr-CA": "Saskatchewan" },
    // The regulation publishes the term in English only; it is kept, not translated.
    term: { "en-CA": { long: "Wildlife Management Zone", short: "WMZ" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    // Numbered zones with their E/W and N/S halves (2E, 68N), and the Saskatoon,
    // Regina-Moose Jaw and Prince Albert zones by the ministry's own codes.
    designationPattern: /^(?:\d{1,2}[EWNS]?|[PRS]WMZ)$/,
    stripLeadingZeros: false,
    // The ministry's own DA_NAME for the three urban zones; the numbered zones are "WMZ No. 55".
    properNames: {
      SWMZ: { "en-CA": "Saskatoon WMZ" },
      RWMZ: { "en-CA": "Regina-Moose Jaw WMZ" },
      PWMZ: { "en-CA": "Prince Albert WMZ" },
    },
  },
  /*
   * United States. Each state publishes in English only, so no French term is
   * recorded and the English term is kept in French. Every pattern is the set
   * of designations the state's own service returned at certification
   * (fixtures/hunt/us-*-live-parity.json). Montana's upland game bird
   * districts are worded ("East of the Continental Divide"): the name is the
   * whole label, with no term in front.
   */
  {
    layerId: "layer:us-id-gmu",
    jurisdictionId: "jurisdiction:us-id",
    zoneIdPrefix: "management_zone:us-id-gmu-",
    officialNamePrefix: "Game Management Unit ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Idaho", "fr-CA": "Idaho" },
    // Idaho's booklet writes "Unit 10A"; the letter is a subdivision.
    term: { "en-CA": { long: "Game Management Unit", short: "Unit" }, "fr-CA": undefined },
    termIsAbbreviation: false,
    designationPattern: /^\d{1,2}[AB]?$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:us-mt-deer-elk-hd",
    jurisdictionId: "jurisdiction:us-mt",
    zoneIdPrefix: "management_zone:us-mt-hd-",
    officialNamePrefix: "Hunting District ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Montana", "fr-CA": "Montana" },
    term: { "en-CA": { long: "Deer and Elk Hunting District", short: "HD" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{3}$/,
    stripLeadingZeros: false,
  },
  {
    // Two districts, named in words by FWP; the name is the whole label.
    layerId: "layer:us-mt-upland",
    jurisdictionId: "jurisdiction:us-mt",
    zoneIdPrefix: "management_zone:us-mt-upland-",
    officialNamePrefix: "",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Montana", "fr-CA": "Montana" },
    term: { "en-CA": { long: "Upland Game Bird District", short: "Upland district" }, "fr-CA": undefined },
    termIsAbbreviation: false,
    designationPattern: /^(East|West) of the Continental Divide$/,
    stripLeadingZeros: false,
    /* FWP names these districts in words rather than numbering them, so the
       designation is already the whole name and the term is not applied on
       top of it. */
    properNames: {
      "East of the Continental Divide": { "en-CA": "East of the Continental Divide" },
      "West of the Continental Divide": { "en-CA": "West of the Continental Divide" },
    },
  },
  {
    layerId: "layer:us-co-gmu",
    jurisdictionId: "jurisdiction:us-co",
    zoneIdPrefix: "management_zone:us-co-gmu-",
    officialNamePrefix: "Game Management Unit ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Colorado", "fr-CA": "Colorado" },
    term: { "en-CA": { long: "Game Management Unit", short: "GMU" }, "fr-CA": undefined },
    termIsAbbreviation: true,
    designationPattern: /^\d{1,3}$/,
    stripLeadingZeros: false,
  },
  {
    layerId: "layer:us-wy-elk-area",
    jurisdictionId: "jurisdiction:us-wy",
    zoneIdPrefix: "management_zone:us-wy-elk-area-",
    officialNamePrefix: "Elk Hunt Area ",
    sourceLocale: "en-CA",
    jurisdictionName: { "en-CA": "Wyoming", "fr-CA": "Wyoming" },
    // Wyoming numbers hunt areas per species; this is the elk series only.
    term: { "en-CA": { long: "Elk Hunt Area", short: "Elk Area" }, "fr-CA": undefined },
    termIsAbbreviation: false,
    designationPattern: /^\d{1,3}$/,
    stripLeadingZeros: false,
  },
];

export type ZonePresentationStatus =
  /** Every part of the label comes from the profile. */
  | "PRESENTED"
  /** The jurisdiction has a profile but the designation is not one it publishes; shown raw with the term. */
  | "UNRECOGNIZED_DESIGNATION"
  /** No profile: the raw designation is shown and nothing is invented. */
  | "UNSUPPORTED_JURISDICTION";

export interface ZonePresentationInput {
  /** The authority's designation ("10O", "57", "69A-1"). */
  designation: string;
  jurisdictionId?: string;
  /** Preferred where designations repeat across layers of one jurisdiction. */
  layerId?: string;
  zoneId?: string;
  officialName?: string;
}

export interface ZonePresentation {
  // Identity — never changed by locale.
  zoneId: string | null;
  jurisdictionId: string | null;
  layerId: string | null;
  sourceDesignation: string;
  officialName: string | null;
  // Presentation — derived for one locale.
  locale: ZoneLocale;
  /** The term as shown in this locale ("WMU", "Zone"). */
  termShort: string | null;
  termLong: string | null;
  /** Cards, results, briefs: "Zone 10 West", "WMU 57", "GHA 38". */
  fullLabel: string;
  /** The readable designation without the term: "10 West", "57", "64B". */
  designationLabel: string;
  /** Map polygons and tight UI, the shortest form: "10W", "57", "64B". */
  compactLabel: string;
  /** For screen readers and titles: "Zone 10 West, Québec", "Wildlife Management Unit 57, Ontario". */
  accessibleLabel: string;
  /** False where the authority publishes no term in this locale and its own is kept. */
  localized: boolean;
  status: ZonePresentationStatus;
}

/** A zone's presentation for one locale. Pure; safe in the browser. */
export function presentZone(input: ZonePresentationInput, locale: ZoneLocale = DEFAULT_ZONE_LOCALE): ZonePresentation {
  const designation = input.designation.trim();
  const profile = profileFor(input);
  if (!profile) {
    const label = designation || input.officialName?.trim() || "Unknown zone";
    return {
      designationLabel: label,
      zoneId: input.zoneId ?? null,
      jurisdictionId: input.jurisdictionId ?? null,
      layerId: input.layerId ?? null,
      sourceDesignation: designation,
      officialName: input.officialName?.trim() || null,
      locale,
      termShort: null,
      termLong: null,
      fullLabel: label,
      compactLabel: label,
      accessibleLabel: label,
      localized: false,
      status: "UNSUPPORTED_JURISDICTION",
    };
  }

  const localizedTerm = profile.term[locale];
  const term = localizedTerm ?? profile.term[profile.sourceLocale] ?? profile.term[DEFAULT_ZONE_LOCALE]!;
  const jurisdictionName = profile.jurisdictionName[locale] ?? profile.jurisdictionName[DEFAULT_ZONE_LOCALE];
  const identity = {
    zoneId: input.zoneId ?? null,
    jurisdictionId: profile.jurisdictionId,
    layerId: profile.layerId,
    sourceDesignation: designation,
    officialName: input.officialName?.trim() || `${profile.officialNamePrefix}${designation}`,
    locale,
    termShort: term.short,
    termLong: term.long,
  };

  if (!profile.designationPattern.test(designation)) {
    const label = `${term.short} ${designation}`;
    return { ...identity, fullLabel: label, designationLabel: designation, compactLabel: designation,
      accessibleLabel: `${profile.termIsAbbreviation ? term.long : term.short} ${designation}, ${jurisdictionName}`,
      localized: false, status: "UNRECOGNIZED_DESIGNATION" };
  }

  const proper = profile.properNames?.[designation];
  if (proper) {
    const name = proper[locale] ?? proper[profile.sourceLocale];
    if (name) {
      return {
        ...identity,
        fullLabel: name,
        designationLabel: name,
        // Tight map space keeps the authority's code, never a truncated proper name.
        compactLabel: designation,
        accessibleLabel: `${name}, ${jurisdictionName}`,
        localized: proper[locale] !== undefined,
        status: "PRESENTED",
      };
    }
  }

  const { full, compact, localized: partsLocalized } = labelParts(profile, designation, locale);
  const fullLabel = `${term.short} ${full}`;
  return {
    ...identity,
    fullLabel,
    designationLabel: full,
    compactLabel: compact,
    accessibleLabel: `${profile.termIsAbbreviation ? term.long : term.short} ${full}, ${jurisdictionName}`,
    localized: localizedTerm !== undefined && partsLocalized,
    status: "PRESENTED",
  };
}

/**
 * A zone's presentation from its canonical id, as a Hunt Brief stores it.
 * The official name, when stored, is checked against the id rather than trusted.
 */
export function presentZoneById(
  zoneId: string,
  locale: ZoneLocale = DEFAULT_ZONE_LOCALE,
  officialName?: string,
): ZonePresentation {
  const profile = ZONE_PRESENTATION_PROFILES.find((entry) => zoneId.startsWith(entry.zoneIdPrefix));
  const name = officialName?.trim();
  if (profile) {
    // Prefer the designation spelled in the stored official name; fall back to the id.
    const fromName = name?.startsWith(profile.officialNamePrefix) ? name.slice(profile.officialNamePrefix.length) : undefined;
    const candidate = fromName && mintZoneId(profile, fromName) === zoneId
      ? fromName
      : zoneId.slice(profile.zoneIdPrefix.length).toUpperCase();
    if (mintZoneId(profile, candidate) === zoneId) {
      return presentZone({ designation: candidate, layerId: profile.layerId, zoneId, officialName: name }, locale);
    }
  }
  return presentZone({ designation: name ?? zoneId, zoneId, officialName: name }, locale);
}

/** Every locale's presentation of one zone, for payloads that serve more than one. */
export function presentZoneInAllLocales(input: ZonePresentationInput): Record<ZoneLocale, ZonePresentation> {
  return Object.fromEntries(ZONE_LOCALES.map((locale) => [locale, presentZone(input, locale)])) as Record<ZoneLocale, ZonePresentation>;
}

export function presentationProfileFor(input: { layerId?: string; jurisdictionId?: string }): ZonePresentationProfile | undefined {
  return profileFor(input);
}

function profileFor(input: { layerId?: string; jurisdictionId?: string }): ZonePresentationProfile | undefined {
  if (input.layerId) return ZONE_PRESENTATION_PROFILES.find((profile) => profile.layerId === input.layerId);
  if (!input.jurisdictionId) return undefined;
  const matches = ZONE_PRESENTATION_PROFILES.filter((profile) => profile.jurisdictionId === input.jurisdictionId);
  // A jurisdiction with several layers must be asked by layer; guessing would mislabel.
  return matches.length === 1 ? matches[0] : undefined;
}

/** Same minting rule as `zoneIdFor` in zone-layers.ts. */
function mintZoneId(profile: ZonePresentationProfile, designation: string): string {
  return `${profile.zoneIdPrefix}${designation.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
}

function labelParts(profile: ZonePresentationProfile, designation: string, locale: ZoneLocale):
  { full: string; compact: string; localized: boolean } {
  const match = /^(\d+)(.*)$/.exec(designation);
  if (!match || !profile.directions) return { full: designation, compact: designation, localized: true };
  const [, digits, suffix] = match;
  const number = profile.stripLeadingZeros ? String(Number(digits)) : digits;
  if (suffix === "") return { full: number, compact: number, localized: true };
  if (profile.preserved?.[designation]) return { full: designation, compact: designation, localized: false };

  const direction = profile.directions.find((entry) => suffix.startsWith(entry.sourceCode));
  if (!direction) return { full: designation, compact: designation, localized: false };
  const rest = suffix.slice(direction.sourceCode.length);
  const words = direction.words[locale] ?? direction.words[profile.sourceLocale];
  if (!words) return { full: designation, compact: designation, localized: false };

  if (rest === "") {
    return { full: `${number} ${words.word}`, compact: `${number}${words.code}`, localized: direction.words[locale] !== undefined };
  }
  const qualifier = profile.qualifiers?.find((entry) => entry.sourceCode === rest);
  if (!qualifier) return { full: designation, compact: designation, localized: false };
  // A territory part keeps the authority's code on the map: no invented compact code.
  return { full: `${number} ${words.word} ${qualifier.text}`, compact: designation, localized: direction.words[locale] !== undefined };
}
