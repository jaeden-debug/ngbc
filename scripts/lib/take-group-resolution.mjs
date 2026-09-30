/**
 * Resolving an authority's GROUP row ("Ducks", "Scaup", "Squirrel (Fox and
 * Gray)", "Softshell turtles (Apalone spp.)") to canonical species — only where
 * authoritative evidence permits, and never past a species' own eligibility.
 *
 * Order matters and is the invariant the owner set: ELIGIBILITY AND EXPLICIT
 * EXCLUSIONS ARE EVALUATED BEFORE GROUP EXPANSION. A member that is NON_QUARRY,
 * LIMITED_TAKE or UNKNOWN is never listed by inheritance (a "swans" season is
 * not trumpeter take); a member the same authority closes by name in the same
 * jurisdiction is excluded; a member NatureServe does not record in the
 * jurisdiction is not attributed (Arizona's "Rattlesnakes (Crotalus)" is not a
 * listing for the eastern diamondback).
 *
 * Membership comes only from:
 *   - the row naming a single species by its common name;
 *   - the source's own enumeration ("Teal (blue-winged, green-winged, cinnamon)");
 *   - the Migratory Birds Regulations' own group wording (Canadian rows);
 *   - 50 CFR 10.13's common-name groups and 50 CFR 20.11(a)'s families (U.S.
 *     migratory rows);
 *   - a genus or family the source itself names.
 * Anything else is UNRESOLVED, BLOCKED_SOURCE or NOT_RELEVANT, with a reason.
 */

export const GROUP_STATES = ["SPECIES_ATTRIBUTED", "GROUP_RULE_LEGALLY_APPLICABLE", "PARTIAL_GROUP_WITH_EXCLUSIONS", "UNRESOLVED", "BLOCKED_SOURCE", "NOT_RELEVANT"];

const EXCLUDED_TAXA = /\b(bats?|mice|mouse|rats?|voles?|shrews?|moles?|rodents?|chipmunks?|gophers?|kangaroo rats?|wood ?rats?|lemmings?|muridae)\b/i;
const FALCONRY = /\b(hawk|owl|falcon|kestrel|goshawk|merlin|eagle)s?\b/i;
/* A listed subspecies' closure: the parent species page carries it as a
   conservation fact; it is not a take row for the parent. */
const SUBSPECIES_CLOSURE = /^(key deer|mount graham red squirrel|florida panther|masked bobwhite)$/i;
const PROTECTED_LISTS = /\b(hawks?|owls?|eagles?|falcons?|kestrel|goshawk|merlin|sea turtles?|jaguar|jaguarundi|ocelot|black-footed ferret|protected)\b/i;
const CATCH_ALL = /\b(unprotected|nongame|non-game|nuisance|all other|other (?:non-native|nongame|unprotected|frogs|reptiles|amphibians)|wildlife|exotic|feral non-native|damag|former game-law|native (?:reptiles?|nongame|kingsnakes)|free-ranging|pets?)\b/i;

const singular = (word) => word.replace(/geese$/, "goose").replace(/ies$/, "y").replace(/(?<!s)s$/, "");

export function makeGroupResolver({ catalogue, byCommonName, shortNames, occurrence, eligibilityOf, federalGroups, mbta, closedPairs }) {
  /* catalogue: Map<speciesId, { title, scientific, family, genus, groups }> */
  const byGenus = new Map();
  const byFamily = new Map();
  for (const [id, record] of catalogue) {
    byGenus.set(record.genus, [...(byGenus.get(record.genus) ?? []), id]);
    if (record.family) byFamily.set(record.family.toLowerCase(), [...(byFamily.get(record.family.toLowerCase()) ?? []), id]);
  }
  const bySci = new Map([...catalogue].map(([id, record]) => [record.scientific.toLowerCase().split(" ").slice(0, 2).join(" "), id]));
  const mbtaGroups = new Map();
  const mbtaSci = new Set();
  for (const entry of mbta) {
    const key = entry.scientificName.toLowerCase();
    mbtaSci.add(key);
    mbtaGroups.set(entry.group.toLowerCase(), [...(mbtaGroups.get(entry.group.toLowerCase()) ?? []), key]);
  }
  const titled = [...catalogue].map(([id, record]) => [id, record.title.toLowerCase()]);

  const occurs = (id, jurisdiction) => {
    const record = occurrence[id];
    if (!record || record.status !== "FOUND") return null;
    /* The federal layer spans Canada: a member is anywhere it occurs in Canada. */
    if (jurisdiction === "ca-federal") {
      return Object.entries(record.jurisdictions ?? {}).some(([key, here]) => key.startsWith("jurisdiction:ca-") && here.present);
    }
    const here = record.jurisdictions?.[`jurisdiction:${jurisdiction}`];
    return Boolean(here?.present);
  };

  /* The gate every candidate passes before it can be attributed. */
  /* kind: NAMED (the source names the species, lists them, or states a genus or
     family), DEFINITION (a regulation's group wording or federal list), or
     PLAIN_MEANING (an unambiguous common word). Only NAMED may reach a
     LIMITED_TAKE species; nothing reaches NON_QUARRY or UNKNOWN. */
  function gate(candidates, row, kind, authorityNamed) {
    const members = [], excluded = [];
    let unrecorded = 0;
    const allowed = kind === "NAMED" ? ["HUNTABLE", "NUISANCE_OR_INVASIVE_TAKE", "LIMITED_TAKE"] : ["HUNTABLE", "NUISANCE_OR_INVASIVE_TAKE"];
    for (const id of candidates) {
      /* Occurrence first: a species not recorded here is simply not a member
         here — neither attributed nor an "exclusion" worth reporting. */
      /* Except where the authority named the species itself: its own listing
         outranks a range record that omits migrants and vagrants. */
      const where = authorityNamed ? true : occurs(id, row.jurisdiction);
      if (where === false) { unrecorded += 1; continue; }
      const eligibility = eligibilityOf(id);
      if (!allowed.includes(eligibility)) { excluded.push({ id, why: `eligibility ${eligibility}` }); continue; }
      if (closedPairs.has(`${id}|${row.jurisdiction}`)) { excluded.push({ id, why: "closed by name in this jurisdiction" }); continue; }
      if (where === null) { excluded.push({ id, why: "no occurrence record" }); continue; }
      members.push(id);
    }
    return { members, excluded, unrecorded };
  }

  function outcome(row, candidates, basis, kind) {
    const { members, excluded, unrecorded } = gate(candidates, row, kind, basis === "the row names this species");
    /* Every candidate absent from the range records is not an empty group rule;
       it is an unanswered one. */
    if (!members.length && !excluded.length && unrecorded) {
      return { state: "UNRESOLVED", members: [], excluded, basis: `${basis}; no candidate member is recorded here by NatureServe`, kind };
    }
    const eligibilityExcluded = excluded.filter((item) => !/occurrence/.test(item.why));
    if (!members.length && excluded.some((item) => /occurrence/.test(item.why))) {
      return { state: "UNRESOLVED", members: [], excluded, basis: `${basis}; occurrence unknown for candidate members`, kind };
    }
    if (!members.length) return { state: eligibilityExcluded.length ? "PARTIAL_GROUP_WITH_EXCLUSIONS" : "GROUP_RULE_LEGALLY_APPLICABLE", members, excluded, basis, kind };
    return { state: eligibilityExcluded.length ? "PARTIAL_GROUP_WITH_EXCLUSIONS" : "SPECIES_ATTRIBUTED", members, excluded, basis, kind };
  }

  /* Authority names that are older or regional names for one species. */
  const AUTHORITY_NAMES = new Map([["common snipe", "species:wilsons-snipe"], ["hungarian partridge", "species:gray-partridge"], ["civet cat", null], ["bobwhite quail", "species:northern-bobwhite"], ["bobwhite", "species:northern-bobwhite"], ["chukar partridge", "species:chukar"], ["groundhog", "species:woodchuck"], ["feral hog", "species:wild-boar"], ["feral swine", "species:wild-boar"], ["wild hog", "species:wild-boar"], ["english sparrow", "species:house-sparrow"], ["starling", "species:european-starling"], ["pine marten", "species:american-marten"], ["sora rail", "species:sora"], ["rooster pheasant", "species:ring-necked-pheasant"], ["hungarian (gray) partridge", "species:gray-partridge"],
    /* Names with exactly one North American referent. */
    ["armadillo", "species:nine-banded-armadillo"], ["ring-tailed cat", "species:ringtail"], ["wild black bear", "species:american-black-bear"],
    ["northern bobwhite quail", "species:northern-bobwhite"], ["white-fronted goose", "species:greater-white-fronted-goose"],
    ["feral pigeon", "species:rock-pigeon"], ["common pigeon", "species:rock-pigeon"], ["coturnix quail", "species:japanese-quail"],
    /* New Mexico's introduced herds are the only free-ranging oryx and ibex on the continent. */
    ["oryx", "species:gemsbok"], ["ibex", "species:persian-ibex"],
    /* Québec's « Pintade »: the helmeted guineafowl, the one guineafowl raised and released. */
    ["pintade", "species:helmeted-guineafowl"]]);
  function speciesByName(name) {
    const key = name.trim().toLowerCase().replace(/’/g, "'");
    const hyphenless = key.replace(/-/g, " ");
    const byHyphen = titled.find(([, title]) => title.replace(/-/g, " ") === hyphenless);
    if (byHyphen && !AUTHORITY_NAMES.has(key)) return byHyphen[0];
    if (AUTHORITY_NAMES.has(key)) return AUTHORITY_NAMES.get(key);
    const direct = byCommonName.get(key) ?? shortNames.get(key);
    if (direct) return direct;
    const singularKey = key.split(" ").map((word, index, all) => (index === all.length - 1 ? singular(word) : word)).join(" ");
    if (singularKey !== key) return speciesByName(singularKey);
    return null;
  }
  /* An ambiguous common name ("gray squirrel") settled only by where the species occur. */
  function speciesByNameHere(name, jurisdiction) {
    const direct = speciesByName(name);
    if (direct) return direct;
    const phrase = name.trim().toLowerCase();
    /* Only a specific name ("gray squirrel"); a bare group word ("quail") is a
       group, and settling it by whichever member happens to occur would hide
       the others. */
    if (!phrase.includes(" ")) return null;
    const candidates = titled.filter(([, title]) => title.endsWith(` ${phrase}`)).map(([id]) => id);
    const here = candidates.filter((id) => occurs(id, jurisdiction) === true);
    return here.length === 1 ? here[0] : null;
  }

  /* "<token> <base>" → the catalogue species whose title is or ends with it,
     disambiguated only by occurrence in the jurisdiction. */
  function enumerated(token, base, jurisdiction) {
    const phrase = `${token} ${base}`.trim().toLowerCase();
    const exact = speciesByName(phrase) ?? speciesByName(token);
    if (exact) return exact;
    const candidates = titled.filter(([, title]) => title === phrase || title.endsWith(` ${phrase}`)).map(([id]) => id);
    if (candidates.length === 1) return candidates[0];
    const here = candidates.filter((id) => occurs(id, jurisdiction) === true);
    return here.length === 1 ? here[0] : null;
  }

  const ofGenus = (...genera) => [...catalogue].filter(([, record]) => genera.includes(record.genus)).map(([id]) => id);
  const ofFamily = (family) => [...catalogue].filter(([, record]) => record.family === family).map(([id]) => id);
  const titleHas = (pattern) => titled.filter(([, title]) => pattern.test(title)).map(([id]) => id);
  /* What each plain word means, as taxa — cottontails are rabbits, ermines are
     weasels, the bobwhite is a quail. */
  const DEFINED = {
    rabbit: () => ofGenus("Sylvilagus", "Oryctolagus", "Brachylagus"),
    cottontail: () => titleHas(/cottontail$/), "cottontail rabbit": () => titleHas(/cottontail$/),
    hare: () => titleHas(/ hare$/), jackrabbit: () => titleHas(/jackrabbit$/), "jack rabbit": () => titleHas(/jackrabbit$/), jack: () => titleHas(/jackrabbit$/),
    weasel: () => ["species:least-weasel", "species:long-tailed-weasel", "species:american-ermine", "species:ermine"],
    skunk: () => ofFamily("Mephitidae"),
    quail: () => [...ofFamily("Odontophoridae"), ...ofGenus("Coturnix")],
    deer: () => ofGenus("Odocoileus"),
    "prairie chicken": () => titleHas(/prairie-chicken$/),
    "tree squirrel": () => titleHas(/(fox|gray|red|douglas|abert's) squirrel$/),
    "softshell turtle": () => titleHas(/softshell/), "soft-shelled turtle": () => titleHas(/softshell/), "soft-shell turtle": () => titleHas(/softshell/),
  };

  return function resolveGroup(row) {
    const raw = row.rawName.replace(/\s+/g, " ").trim();
    const lower = raw.toLowerCase();
    if (row.status === "UNVERIFIED_SEASON") return { state: "BLOCKED_SOURCE", members: [], excluded: [], basis: "authority site blocked; statute stub only" };

    /* 1. The row is one species by its common name. */
    const single = speciesByNameHere(raw, row.jurisdiction) ?? speciesByNameHere(raw.replace(/\s*\(.*\)\s*$/, ""), row.jurisdiction);
    if (single) return outcome(row, [single], "the row names this species", "NAMED");

    if (FALCONRY.test(lower)) return { state: "NOT_RELEVANT", members: [], excluded: [], basis: "raptors: falconry capture or protection, not quarry take" };
    if (SUBSPECIES_CLOSURE.test(raw)) return { state: "NOT_RELEVANT", members: [], excluded: [], basis: "closure of a listed subspecies; recorded on the parent species as conservation status" };
    const inParentheses = raw.match(/\(([^)]+)\)/)?.[1];
    if (inParentheses && !/,| and |&/.test(inParentheses)) {
      const named = speciesByNameHere(inParentheses, row.jurisdiction);
      if (named) return outcome(row, [named], "the row names this species", "NAMED");
    }
    if (EXCLUDED_TAXA.test(lower) && !/squirrel|prairie dog|woodchuck|groundhog/.test(lower)) return { state: "NOT_RELEVANT", members: [], excluded: [], basis: "excluded taxa (take-exclusions.csv)" };
    if (PROTECTED_LISTS.test(lower) && row.status === "CLOSED_THIS_YEAR") return { state: "NOT_RELEVANT", members: [], excluded: [], basis: "protected list, no take" };

    /* 2. The source names a genus or family. */
    const genusMatch = raw.match(/\(([A-Z][a-z]+)(?: spp\.?)?\)/) ?? raw.match(/\bgenus ([A-Z][a-z]+)/);
    if (genusMatch && byGenus.has(genusMatch[1])) return outcome(row, byGenus.get(genusMatch[1]), `the source names the genus ${genusMatch[1]}`, "NAMED");
    const familyMatch = raw.match(/family ([A-Z][a-z]+idae)/);
    if (familyMatch && byFamily.has(familyMatch[1].toLowerCase())) return outcome(row, byFamily.get(familyMatch[1].toLowerCase()), `the source names the family ${familyMatch[1]}`, "NAMED");

    /* 3. The source enumerates members: "Teal (blue-winged, green-winged, cinnamon)",
          "Squirrel (Fox and Gray)", "Fox, Red and Gray". */
    const listMatch = raw.match(/^([A-Za-z' -]+?)\s*[(,:]\s*([^)]+)\)?$/);
    if (listMatch) {
      const base = singular(listMatch[1].trim().toLowerCase().split(" ").at(-1));
      const tokens = listMatch[2].replace(/\bcombined\b|\bonly\b|\bearly season\b|\bspecial season\b|\bseptember season\b|\bincl\.?.*$/gi, "")
        .split(/,|&|\band\b|\bor\b|\//).map((token) => token.trim().toLowerCase()).filter((token) => token && !/^(all|other|the)$/.test(token));
      if (tokens.length >= 1 && tokens.length <= 8 && !/except|excluding|other than|including/i.test(listMatch[2])) {
        const resolved = tokens.map((token) => {
          const bare = singular(token.replace(/s$/, ""));
          if (!token.includes(" ") && DEFINED[bare]) return DEFINED[bare]();
          const one = enumerated(token.replace(/\bblue\b(?= *$)/, "snow"), base, row.jurisdiction);
          if (one) return [one];
          const word = singular(token.replace(/s$/, ""));
          return DEFINED[word] ? DEFINED[word]() : null;
        });
        if (resolved.every(Boolean)) return outcome(row, [...new Set(resolved.flat())], "the source enumerates its members", "NAMED");
      }
    }

    /* 4. Canadian migratory rows: the Migratory Birds Regulations' own group wording. */
    if (row.jurisdiction.startsWith("ca-")) {
      const stated = lower.replace(/,\s*combined$/, "").replace(/[’']/g, "'");
      const group = federalGroups.find((entry) => [entry.statedAs, ...(entry.aliases ?? [])].some((text) => text.toLowerCase().replace(/,\s*combined$/, "").replace(/[’']/g, "'") === stated));
      if (group) return outcome(row, group.members, `Migratory Birds Regulations group "${group.statedAs}"`, "DEFINITION");
    }

    /* 5. U.S. migratory rows: 50 CFR 10.13's common-name groups; 50 CFR 20.11(a) families. */
    const words = lower.replace(/\(.*?\)/g, " ").split(/[^a-z-]+/).filter(Boolean).map(singular);
    const excepting = /except|excluding|other than/.test(lower);
    const inMbta = (id) => mbtaSci.has(catalogue.get(id).scientific.toLowerCase().split(" ").slice(0, 2).join(" "));
    const ofGroup = (group) => [...catalogue].filter(([, record]) => record.groups.includes(group)).map(([id]) => id).filter(inMbta);
    if (!excepting && words.length && words.length <= 5) {
      const candidates = new Set();
      let recognised = words.length > 0;
      for (const word of words) {
        if (["combined", "zone", "zones", "a", "b", "c", "season", "september", "early", "special", "including", "all", "and", "wild", "bluebill"].includes(word)) continue;
        if (word === "duck" || word === "waterfowl") { ofGroup("species_group:ducks").forEach((id) => candidates.add(id)); continue; }
        if (word === "goose") {
          const light = /light|snow|ross/.test(lower);
          const dark = /dark/.test(lower);
          for (const id of ofGroup("species_group:geese")) {
            const isLight = ["species:snow-goose", "species:rosss-goose"].includes(id);
            if ((light && !dark && !isLight) || (dark && isLight)) continue;
            candidates.add(id);
          }
          continue;
        }
        if (["light", "dark", "blue", "snow", "ross"].includes(word)) continue;
        const group = mbtaGroups.get(word);
        if (group) { group.map((sci) => bySci.get(sci)).filter(Boolean).forEach((id) => candidates.add(id)); continue; }
        recognised = false;
      }
      if (recognised && candidates.size) return outcome(row, [...candidates], "50 CFR 10.13 common-name groups / 50 CFR 20.11(a) families", "DEFINITION");
    }

    /* 6. Plain meaning of an unambiguous common word, only across species
          NatureServe records here. Words whose everyday use is narrower than a
          name match ("squirrel" seasons mean tree squirrels, "frogs" a
          fishing-rule subset) are not in this list; "deer" is defined as the
          native genus Odocoileus, never fallow, sika or axis deer. */
    const plain = lower.replace(/\(.*?\)/g, "").replace(/[^a-z -]/g, " ").replace(/\s+/g, " ").trim();
    const PLAIN_WORDS = ["deer", "prairie chicken", "weasel", "skunk", "fox", "otter", "opossum", "pheasant", "quail", "rabbit", "cottontail", "cottontail rabbit", "jackrabbit", "jack rabbit", "hare", "ptarmigan", "prairie dog", "ground squirrel", "softshell turtle", "soft-shelled turtle", "soft-shell turtle", "marmot", "mink", "marten", "raccoon", "badger", "beaver", "muskrat", "porcupine", "coyote", "bobcat", "lynx", "fisher", "wolverine", "flying squirrel", "tree squirrel"];
    const word = singular(plain.split(" ").map(singular).join(" "));
    /* A qualifier the plain word would drop ("Rabbit (Jack)") means the row is
       not the plain word. */
    if (PLAIN_WORDS.includes(word) && !excepting && !/\(/.test(raw)) {
      const candidates = DEFINED[word] ? DEFINED[word]() : titleHas(new RegExp(`(^| )${word}$`));
      if (candidates.length) return outcome(row, candidates, `plain meaning of "${word}", restricted to species NatureServe records here`, "PLAIN_MEANING");
    }

    if (CATCH_ALL.test(lower)) return { state: "GROUP_RULE_LEGALLY_APPLICABLE", members: [], excluded: [], basis: "a broad legal class; members are not attributable from the source" };
    return { state: "UNRESOLVED", members: [], excluded: [], basis: excepting ? "the source's exceptions need reading" : "no authoritative membership for this group in the sources read" };
  };
}
