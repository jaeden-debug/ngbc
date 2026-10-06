/**
 * Who a photograph must show, and every name that could say so — built from the
 * canonical species records, never from a provider's search relevance.
 *
 * A provider's search result is candidate discovery. Whether a candidate names
 * THIS species is decided here, by exact names on normalised text:
 *
 * - A name shared by two catalogue species ("ermine" names both Mustela
 *   erminea and M. richardsonii) is AMBIGUOUS and can identify neither.
 * - A name built only from ordinary words ("green frog", "brown snake") reads
 *   as a description as easily as a name, so it is GENERIC and cannot identify
 *   on its own; the binomial still can.
 * - An occurrence inside a longer known name does not count: "ferret" inside
 *   "black-footed ferret" is not the feral ferret.
 * - Any other species named in the same text is a conflict.
 */

export interface SpeciesIdentityInput {
  speciesId: string;
  commonName: string;
  scientificName: string;
  /** Verified common-name aliases from the canonical entity. */
  aliases: string[];
  groupIds: string[];
}

export interface IdentityPolicyEntry {
  /** A better search phrase where the bare name also means something else. */
  queryHint?: string;
  /** Extra unambiguous names the canonical record does not carry (e.g. "cougar"). */
  extraNames?: string[];
  /** Names that must not identify this species on their own. */
  ambiguousNames?: string[];
  /** Descriptive-looking names that are in fact this species' established name ("red deer"). */
  allowGenericNames?: string[];
  /** The binomial is the only acceptable identification. */
  requireScientificName?: boolean;
  note?: string;
}

export interface IdentityPolicy {
  species: Record<string, IdentityPolicyEntry>;
  /** Names of animals outside the catalogue that a photograph could show instead. */
  externalLookalikes: string[];
}

export interface SpeciesImageIdentity {
  speciesId: string;
  commonName: string;
  scientificName: string;
  /** Names that identify this species, normalised. */
  identifyingNames: string[];
  /** Names that point at this species but cannot identify it alone, with why. */
  weakNames: Array<{ name: string; reason: "SHARED_WITH_OTHER_SPECIES" | "GENERIC_WORDS" | "POLICY" }>;
  scientific: string;
  queries: string[];
  requireScientificName: boolean;
  groupIds: string[];
}

/** Words that describe an animal rather than name it. */
const DESCRIPTORS = new Set([
  "green", "brown", "gray", "black", "red", "white", "yellow", "blue", "golden", "orange", "dark", "pale",
  "spotted", "striped", "banded", "ringed", "common", "little", "small", "large", "great", "giant", "wild",
  "feral", "domestic", "mud", "wood", "river", "rock", "tree", "water", "ground", "garden", "house", "field",
  "pond", "marsh", "swamp", "brush", "forest", "mountain", "desert", "sand", "stream", "lake", "sea", "night",
  "worm", "pine", "rough", "smooth",
]);
/** Nouns any photograph of the group could carry. */
const GENERIC_NOUNS = new Set([
  "frog", "toad", "snake", "turtle", "lizard", "salamander", "skink", "gecko", "newt", "treefrog",
  "duck", "goose", "swan", "dove", "pigeon", "squirrel", "rabbit", "hare", "fox", "goat", "sheep", "deer",
  "bear", "wolf", "cat", "rat", "mouse", "bird", "owl", "crow", "hen", "quail", "partridge", "pheasant",
  "slider", "cooter", "terrapin", "boa", "racer", "ferret", "weasel", "skunk", "otter", "pig", "hog",
]);

/** Lower case, no diacritics or punctuation, "grey" spelled "gray". */
function plainWords(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bgrey\b/g, "gray")
    .trim();
}

/**
 * The form names and captions are compared in. "garter snake" and
 * "gartersnake", "tree frog" and "treefrog" are one spelling here, because
 * captions use both.
 */
export function normalizeText(value: string): string {
  return plainWords(value).replace(/\b([a-z]+) (snake|frog|toad)\b/g, "$1$2");
}

const IRREGULAR_PLURALS: Record<string, string> = { goose: "(?:goose|geese)", wolf: "(?:wolf|wolves)", mouse: "(?:mouse|mice)" };

function nameExpression(normalizedName: string): string {
  const words = normalizedName.split(" ");
  const last = words.pop()!;
  const tail = IRREGULAR_PLURALS[last] ?? `${last}(?:s|es)?`;
  return [...words, tail].join(" ");
}

/** Every [start, end) where the normalised name occurs as whole words in normalised text. */
export function occurrences(normalizedText: string, normalizedName: string): Array<[number, number]> {
  if (!normalizedName) return [];
  const pattern = new RegExp(`(?<![a-z0-9])${nameExpression(normalizedName)}(?![a-z0-9])`, "g");
  const spans: Array<[number, number]> = [];
  for (const match of normalizedText.matchAll(pattern)) spans.push([match.index!, match.index! + match[0].length]);
  return spans;
}

/**
 * "green frog", "spotted dove", "mountain goat": a name made of describing
 * words and a group noun reads as a description as easily as a name.
 */
export function isGenericName(name: string): boolean {
  const words = plainWords(name).split(" ").filter(Boolean);
  const last = words.pop();
  if (!last) return false;
  return GENERIC_NOUNS.has(last) && words.every((word) => DESCRIPTORS.has(word));
}

export interface NameLexicon {
  /** normalised name → the species ids it names ("external:*" for non-catalogue lookalikes). */
  owners: Map<string, Set<string>>;
  /** Every catalogue genus, lower case, for reading binomials the catalogue does not hold. */
  genera: Set<string>;
  /** Genera that are also ordinary English names ("lynx", "bison"): read only when capitalised. */
  englishGenera: Set<string>;
}

export function buildLexicon(species: SpeciesIdentityInput[], policy: IdentityPolicy): NameLexicon {
  const owners = new Map<string, Set<string>>();
  const add = (name: string, owner: string) => {
    const key = normalizeText(name);
    if (!key) return;
    const set = owners.get(key) ?? new Set<string>();
    set.add(owner);
    owners.set(key, set);
  };
  for (const entry of species) {
    add(entry.commonName, entry.speciesId);
    add(entry.scientificName, entry.speciesId);
    for (const alias of entry.aliases) add(alias, entry.speciesId);
    for (const extra of policy.species[entry.speciesId]?.extraNames ?? []) add(extra, entry.speciesId);
  }
  for (const name of policy.externalLookalikes) add(name, `external:${normalizeText(name).replace(/ /g, "-")}`);
  const genera = new Set(species.map((entry) => entry.scientificName.split(/\s+/)[0].toLowerCase()));
  const vernacular = new Set(species.flatMap((entry) => [entry.commonName, ...entry.aliases])
    .flatMap((name) => plainWords(name).split(" ")));
  const englishGenera = new Set([...genera].filter((genus) => vernacular.has(genus)));
  return { owners, genera, englishGenera };
}

export function buildIdentity(entry: SpeciesIdentityInput, lexicon: NameLexicon, policy: IdentityPolicy): SpeciesImageIdentity {
  const rule = policy.species[entry.speciesId] ?? {};
  const policyAmbiguous = new Set((rule.ambiguousNames ?? []).map(normalizeText));
  const scientific = normalizeText(entry.scientificName);
  const allowGeneric = new Set((rule.allowGenericNames ?? []).map(normalizeText));
  const identifyingNames: string[] = [];
  const weakNames: SpeciesImageIdentity["weakNames"] = [];
  const seen = new Set<string>();
  for (const raw of [entry.commonName, ...entry.aliases, ...(rule.extraNames ?? [])]) {
    const name = normalizeText(raw);
    if (!name || name === scientific || seen.has(name)) continue;
    seen.add(name);
    const shared = [...(lexicon.owners.get(name) ?? [])].some((owner) => owner !== entry.speciesId);
    if (policyAmbiguous.has(name)) weakNames.push({ name, reason: "POLICY" });
    else if (shared) weakNames.push({ name, reason: "SHARED_WITH_OTHER_SPECIES" });
    else if (isGenericName(raw) && !allowGeneric.has(name)) weakNames.push({ name, reason: "GENERIC_WORDS" });
    else identifyingNames.push(name);
  }
  const primary = rule.queryHint ?? entry.commonName;
  /*
   * A second search, used only when the first named nothing. Search is only
   * discovery — the caption must still name the species — so a broader query
   * cannot lower the bar: an identifying alias first, then the name without
   * punctuation (the provider's search can return nothing for "Abert's
   * squirrel"), then the head noun ("opossum").
   */
  const alias = rule.requireScientificName ? undefined : entry.aliases.find((raw) =>
    identifyingNames.includes(normalizeText(raw)) && normalizeText(raw) !== normalizeText(primary));
  const plain = entry.commonName.replace(/['’]/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const head = entry.commonName.split(/[\s-]+/).pop() ?? "";
  const fallback = [alias, plain, head].find((query) =>
    query && query.toLowerCase() !== primary.toLowerCase() && query.toLowerCase() !== entry.commonName.toLowerCase()
    && (query !== head || entry.commonName.split(/[\s-]+/).length > 1));
  const queries = fallback ? [primary, fallback] : [primary];
  return {
    speciesId: entry.speciesId,
    commonName: entry.commonName,
    scientificName: entry.scientificName,
    identifyingNames: rule.requireScientificName ? [] : identifyingNames,
    weakNames: rule.requireScientificName
      ? [...weakNames, ...identifyingNames.map((name) => ({ name, reason: "POLICY" as const }))]
      : weakNames,
    scientific,
    queries,
    requireScientificName: Boolean(rule.requireScientificName),
    groupIds: entry.groupIds,
  };
}

export interface NameReading {
  /** The species' own binomial appears. */
  scientific: boolean;
  /** Binomials in a catalogue genus that are not this species' own ("Ovis gmelini" on a mouflon). */
  otherBinomials: string[];
  /** Identifying common names that appear, not inside a longer known name. */
  identifying: string[];
  /** Weak names that appear. */
  weak: string[];
  /** Other species (or external lookalikes) named in the text. */
  others: string[];
}

/**
 * What a piece of text says about which animal it describes. An occurrence
 * wholly inside a longer known name belongs to that longer name.
 */
export function readNames(text: string, identity: SpeciesImageIdentity, lexicon: NameLexicon): NameReading {
  const normalized = normalizeText(text);
  const found: Array<{ name: string; span: [number, number]; owners: Set<string> }> = [];
  for (const [name, owners] of lexicon.owners) {
    for (const span of occurrences(normalized, name)) found.push({ name, span, owners });
  }
  const covered = (item: (typeof found)[number]) => found.some((other) =>
    other !== item && other.name.length > item.name.length
    && other.span[0] <= item.span[0] && other.span[1] >= item.span[1]);
  const standalone = found.filter((item) => !covered(item));

  const identifying = new Set<string>();
  const weak = new Set<string>();
  const others = new Set<string>();
  let scientific = false;
  const weakSet = new Set(identity.weakNames.map(({ name }) => name));
  for (const item of standalone) {
    const mine = item.owners.has(identity.speciesId);
    if (item.name === identity.scientific && mine) scientific = true;
    else if (mine && identity.identifyingNames.includes(item.name)) identifying.add(item.name);
    else if (mine && (weakSet.has(item.name) || item.owners.size > 1)) weak.add(item.name);
    else if (!mine) for (const owner of item.owners) others.add(owner);
  }
  return { scientific, otherBinomials: otherBinomials(text, identity, lexicon), identifying: [...identifying], weak: [...weak], others: [...others] };
}

/**
 * A binomial the caption gives that is not the species' own. A caption naming
 * the right common name beside a different binomial disagrees with itself, and
 * a disagreeing caption does not identify anything. A subspecies trinomial of
 * the species' own binomial ("Ovis canadensis nelsoni") is its own.
 */
function otherBinomials(text: string, identity: SpeciesImageIdentity, lexicon: NameLexicon): string[] {
  const found = new Set<string>();
  const plain = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  for (const match of plain.matchAll(/\b([A-Za-z]{3,})\s+([a-z]{3,})\b/g)) {
    const [, genusRaw, epithet] = match;
    const genus = genusRaw.toLowerCase();
    if (!lexicon.genera.has(genus)) continue;
    const capitalised = genusRaw[0] === genusRaw[0].toUpperCase() && genusRaw.slice(1) === genusRaw.slice(1).toLowerCase();
    if (lexicon.englishGenera.has(genus) && !capitalised) continue;
    const binomial = `${genus} ${epithet}`;
    if (binomial === identity.scientific) continue;
    // An English-name genus followed by an English word ("Lynx stares") is prose, not a binomial,
    // unless the pair is one the catalogue itself holds.
    if (lexicon.englishGenera.has(genus) && !lexicon.owners.has(binomial) && !/(us|um|a|is|ae|i|ii|ensis|oides|ata|atus|ana|anus)$/.test(epithet)) continue;
    found.add(binomial);
  }
  return [...found];
}
