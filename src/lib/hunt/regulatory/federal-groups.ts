/**
 * What the Migratory Birds Regulations actually regulate: GROUPS, not species.
 *
 * Schedule 3 sets a season and a limit for "all Ducks, combined", for "Canada
 * Geese, Cackling Geese, White-fronted Geese and Brant, combined", for "Ducks
 * (other than Harlequin Ducks, Common and Red-breasted Mergansers, Long-tailed
 * Ducks, Eiders and Scoters), combined". A hunter holding a mallard is bound by
 * the duck group's limit, shared with every other duck they took that day.
 *
 * THE LIMIT IS NEVER PER SPECIES. A combined daily bag of 6 across seventeen
 * duck species is not a limit of 6 on mallard, and a page that prints "6" next
 * to mallard tells a hunter they may take six mallards. Every group below
 * carries the regulation's own words so an answer can say what the limit is
 * shared WITH, and `federal.ts` refuses to emit a limit without them.
 *
 * `members` lists only the canonical species North Ground's library holds.
 * `coversUnlistedSpecies` records that the regulation's group is wider than
 * that — the limit is shared with birds North Ground does not publish, which
 * makes the shared limit MORE binding, never less.
 */

import type { CanonicalId } from "../../content-contract/index.ts";

export interface FederalGroup {
  id: string;
  /** The regulation's own words for this group, verbatim. */
  statedAs: string;
  /** Spelling variants of the same group across Parts of Schedule 3. */
  aliases?: readonly string[];
  /** Canonical species in North Ground's library that fall in this group. */
  members: ReadonlyArray<CanonicalId<"species">>;
  /**
   * True where the regulation's group includes birds the library does not
   * hold, so the shared limit binds more species than `members` shows.
   */
  coversUnlistedSpecies: boolean;
}

const ids = (...slugs: string[]) => slugs.map((slug) => `species:${slug}`) as ReadonlyArray<CanonicalId<"species">>;

/*
 * Members are the species the REGULATION'S OWN WORDS name, resolved to the
 * catalogue. "Common and Red-breasted Mergansers" is two species; "Eiders" is
 * every eider the catalogue offers as quarry. A species whose take eligibility
 * grants no Hunt offer (Steller's and spectacled eiders, NON_QUARRY) is never a
 * member by inheritance: `federal-groups.test.ts` refuses it, and the group
 * says `coversUnlistedSpecies` so the shared limit is still stated as wider.
 */
const DUCKS_NOT_SEA_DUCKS = ids(
  "american-black-duck", "american-wigeon", "barrows-goldeneye", "blue-winged-teal", "bufflehead", "canvasback",
  "common-goldeneye", "gadwall", "greater-scaup", "green-winged-teal", "lesser-scaup", "mallard", "northern-pintail",
  "northern-shoveler", "redhead", "ring-necked-duck", "wood-duck", "hooded-merganser", "ruddy-duck", "cinnamon-teal",
  "eurasian-wigeon", "mottled-duck", "mexican-duck", "black-bellied-whistling-duck", "fulvous-whistling-duck",
);
const MERGANSERS = ids("common-merganser", "red-breasted-merganser");
const LONG_TAILED = ids("long-tailed-duck");
const EIDERS = ids("common-eider", "king-eider");
const SCOTERS = ids("black-scoter", "surf-scoter", "white-winged-scoter");
const HARLEQUIN = ids("harlequin-duck");
const ALL_DUCKS = [...DUCKS_NOT_SEA_DUCKS, ...MERGANSERS, ...LONG_TAILED, ...EIDERS, ...SCOTERS, ...HARLEQUIN];

const TRUE_GEESE = ids("canada-goose", "cackling-goose", "greater-white-fronted-goose", "snow-goose", "rosss-goose", "brant", "emperor-goose");

/**
 * Every group phrasing Schedule 3 uses, with its variants.
 *
 * Case and hyphenation differ between Parts ("all Geese" / "All Geese",
 * "Band-tailed" / "Band-Tailed", "Sandhill Crane" / "Sandhill Cranes",
 * "Eurasian Collared Doves" / "Eurasian Collared-Doves"). Those are the same
 * group written twice, and are listed as aliases rather than normalised by a
 * rule, because a rule that lowercases and strips hyphens would also merge
 * groups that genuinely differ — "Ducks (other than Harlequin Ducks)" and
 * "Ducks (other than Harlequin Ducks, ... Long-tailed Ducks, Eiders and
 * Scoters)" are different groups with different limits.
 */
export const FEDERAL_GROUPS: readonly FederalGroup[] = [
  {
    id: "federal_group:all-ducks",
    statedAs: "all Ducks, combined",
    aliases: ["All Ducks, combined"],
    members: ALL_DUCKS,
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:ducks-other-than-harlequin",
    statedAs: "Ducks (other than Harlequin Ducks), combined",
    members: ALL_DUCKS.filter((id) => !HARLEQUIN.includes(id)),
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:ducks-other-than-sea-ducks",
    statedAs:
      "Ducks (other than Harlequin Ducks, Common and Red-breasted Mergansers, Long-tailed Ducks, Eiders and Scoters), combined",
    members: DUCKS_NOT_SEA_DUCKS,
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:ducks-other-than-sea-ducks-no-long-tailed",
    statedAs:
      "Ducks (other than Harlequin Ducks, Common and Red-breasted Mergansers, Eiders and Scoters), combined",
    members: [...DUCKS_NOT_SEA_DUCKS, ...LONG_TAILED],
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:sea-ducks",
    statedAs: "Common and Red-breasted Mergansers, Long-tailed Ducks, Eiders and Scoters, combined",
    /* North Ground publishes none of these; the group is real and answers for
       no library species until they are added. */
    members: [...MERGANSERS, ...LONG_TAILED, ...EIDERS, ...SCOTERS],
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:mergansers",
    statedAs: "Common and Red-breasted Mergansers, combined",
    members: MERGANSERS,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:long-tailed-eiders-scoters",
    statedAs: "Long-tailed Ducks, Eiders and Scoters, combined",
    members: [...LONG_TAILED, ...EIDERS, ...SCOTERS],
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:eiders-scoters",
    statedAs: "all Eiders and Scoters, combined",
    members: [...EIDERS, ...SCOTERS],
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:harlequin-long-tailed-eiders-scoters",
    statedAs: "Harlequin Ducks, Long-tailed Ducks, Eiders and Scoters, combined",
    members: [...HARLEQUIN, ...LONG_TAILED, ...EIDERS, ...SCOTERS],
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:harlequin-ducks",
    statedAs: "Harlequin Ducks",
    members: HARLEQUIN,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:all-geese",
    statedAs: "all Geese, combined",
    aliases: ["All Geese, combined"],
    members: TRUE_GEESE,
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:canada-cackling",
    statedAs: "Canada Geese and Cackling Geese, combined",
    members: ["species:canada-goose", "species:cackling-goose"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:canada-cackling-whitefronted",
    statedAs: "Canada Geese, Cackling Geese and White-fronted Geese, combined",
    members: [
      "species:canada-goose", "species:cackling-goose", "species:greater-white-fronted-goose",
    ] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:canada-cackling-whitefronted-brant",
    statedAs: "Canada Geese, Cackling Geese, White-fronted Geese and Brant, combined",
    members: [
      "species:canada-goose", "species:cackling-goose", "species:greater-white-fronted-goose", "species:brant",
    ] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:canada-geese",
    statedAs: "Canada Geese",
    members: ["species:canada-goose"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:white-fronted-geese",
    statedAs: "White-fronted Geese",
    members: ["species:greater-white-fronted-goose"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:brant",
    statedAs: "Brant",
    members: ["species:brant"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:snow-ross",
    statedAs: "Snow Geese and Ross’s Geese, combined",
    /* Ross's Goose is not in the library; the limit is shared with it. */
    members: ids("snow-goose", "rosss-goose"),
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:snow-geese",
    statedAs: "Snow Geese",
    members: ["species:snow-goose"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:geese-other-than-canada-cackling-snow-ross",
    statedAs: "Geese (other than Canada Geese, Cackling Geese, Snow Geese and Ross’s Geese), combined",
    members: ids("greater-white-fronted-goose", "brant", "emperor-goose"),
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:geese-other-than-snow-canada-cackling",
    statedAs: "Geese (other than Snow Geese, Canada Geese and Cackling Geese), combined",
    members: ids("greater-white-fronted-goose", "brant", "rosss-goose", "emperor-goose"),
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:sandhill-cranes",
    statedAs: "Sandhill Cranes",
    aliases: ["Sandhill Crane"],
    members: ["species:sandhill-crane"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:snipe",
    statedAs: "Snipe",
    /* Wilson's Snipe is the only snipe hunted in Canada. */
    members: ["species:wilsons-snipe"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:woodcock",
    statedAs: "Woodcock",
    members: ["species:american-woodcock"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:mourning-doves",
    statedAs: "Mourning Doves",
    members: ["species:mourning-dove"] as ReadonlyArray<CanonicalId<"species">>,
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:mourning-and-collared-doves",
    statedAs: "Mourning Doves and Eurasian Collared-Doves, combined",
    aliases: ["Mourning Doves and Eurasian Collared Doves, combined"],
    members: ids("mourning-dove", "eurasian-collared-dove"),
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:band-tailed-pigeons",
    statedAs: "Band-tailed Pigeons",
    aliases: ["Band-Tailed Pigeons"],
    members: ids("band-tailed-pigeon"),
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:coots",
    statedAs: "Coots",
    members: ids("american-coot"),
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:coots-gallinules",
    statedAs: "Coots and Gallinules, combined",
    members: ids("american-coot", "common-gallinule", "purple-gallinule"),
    coversUnlistedSpecies: false,
  },
  {
    id: "federal_group:rails-coots",
    statedAs: "Rails and Coots, combined",
    members: ids("virginia-rail", "sora", "king-rail", "clapper-rail", "american-coot"),
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:rails-coots-gallinules",
    statedAs: "Rails (other than Yellow Rails and King Rails), Coots and Gallinules, combined",
    members: ids("virginia-rail", "sora", "clapper-rail", "american-coot", "common-gallinule", "purple-gallinule"),
    coversUnlistedSpecies: true,
  },
  {
    id: "federal_group:murres",
    statedAs: "Murres",
    members: ids("thick-billed-murre", "common-murre"),
    coversUnlistedSpecies: false,
  },
];

const BY_TEXT = new Map<string, FederalGroup>();
for (const group of FEDERAL_GROUPS) {
  BY_TEXT.set(group.statedAs, group);
  for (const alias of group.aliases ?? []) BY_TEXT.set(alias, group);
}

/** A repealed row is not a rule. It is never encoded. */
export const isRepealedRow = (text: string): boolean => /^\[Repealed/i.test(text.trim());

/**
 * The group a Schedule 3 species cell names, or undefined.
 *
 * Matched on the regulation's exact words. Nothing is inferred from a partial
 * match: a cell this does not recognise stops the build rather than being
 * attached to the nearest-looking group, because attaching a season to the
 * wrong group is a wrong answer that looks entirely normal.
 */
export function federalGroupFor(speciesCell: string): FederalGroup | undefined {
  return BY_TEXT.get(speciesCell.replace(/^\([a-z]+\)\s*/, "").trim());
}

/** Every group a canonical species belongs to. */
export function groupsForSpecies(speciesId: string): readonly FederalGroup[] {
  return FEDERAL_GROUPS.filter((group) => (group.members as readonly string[]).includes(speciesId));
}
