/**
 * Manitoba's big game beyond white-tailed deer: mule deer (Schedule B.1), elk
 * (Schedule C), moose (Schedule D) and black bear (Schedule F) of M.R. 165/91.
 *
 * Everything here is read from the regulation's own words:
 *
 *   - which licence a part of a schedule belongs to, from the part's heading;
 *   - what equipment it permits, from the licence's name (s. 3.2 "general",
 *     s. 3.3 "archery") or, where a schedule has an equipment column, from that
 *     column (s. 3.4 "all equipment"). s. 3.2(2) keeps "general" from meaning
 *     all equipment for deer and bear licences, which is why those schedules
 *     state equipment per row;
 *   - what animal may be taken, from the bag-limit column or section, in the
 *     regulation's own classes: "male" (s. 1, antlers more than 10 cm) and
 *     "antlerless" (s. 1, without antlers or with antlers less than 10 cm).
 *
 * A part heading, bag phrase or equipment word not listed here stops the build:
 * a new licence could open seasons this bundle would silently miss.
 */

export const MULE_DEER = "species:mule-deer";
export const ELK = "species:elk";
export const MOOSE = "species:moose";
export const BLACK_BEAR = "species:american-black-bear";

/* s. 3.2(1): "general" in a licence's name. */
const GENERAL = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"];
/* s. 3.3: "archery" in a licence's name. */
const ARCHERY = ["BOW"];

const MB = "MANITOBA_RESIDENT";
const CA = "CANADIAN_RESIDENT";
const NC = "NON_CANADIAN_RESIDENT";

/** Each licence part, by the heading the regulation prints, and the section that empowers it. */
export const BIG_GAME_PARTS = {
  "SchB.1": {
    "MANITOBA RESIDENT GENERAL MULE DEER LICENCE": {
      licence: "MB_RESIDENT_GENERAL_MULE_DEER", residency: MB, section: "s. 11.1",
      bag: { bag: 1, animalClass: "ANY", statedAs: "one mule deer", section: "s. 11.5(1)" },
    },
    "MANITOBA RESIDENT SECOND MULE DEER LICENCE": {
      licence: "MB_RESIDENT_SECOND_MULE_DEER", residency: MB, section: "s. 11.2",
      bag: { bag: 1, animalClass: "ANTLERLESS", statedAs: "one antlerless mule deer", section: "s. 11.5(2), (3)" },
      conditions: ["ca-mb-md-second-licence-prerequisite"],
    },
    "MANITOBA RESIDENT THIRD MULE DEER LICENCE": {
      licence: "MB_RESIDENT_THIRD_MULE_DEER", residency: MB, section: "s. 11.3",
      bag: { bag: 1, animalClass: "ANTLERLESS", statedAs: "one antlerless mule deer", section: "s. 11.5(2), (3)" },
      conditions: ["ca-mb-md-third-licence-prerequisite"],
    },
  },
  SchC: {
    "MANITOBA RESIDENT DRAW ARCHERY ELK LICENCE": {
      licence: "MB_RESIDENT_DRAW_ARCHERY_ELK", residency: MB, section: "s. 12", implements: ARCHERY, archery: true,
      conditions: ["ca-mb-big-game-draw"],
    },
    "MANITOBA RESIDENT DRAW GENERAL ELK LICENCE": {
      licence: "MB_RESIDENT_DRAW_GENERAL_ELK", residency: MB, section: "s. 13", implements: GENERAL,
      conditions: ["ca-mb-big-game-draw"],
    },
    "MANITOBA RESIDENT LANDOWNER DRAW GENERAL ELK LICENCE": {
      licence: "MB_RESIDENT_LANDOWNER_DRAW_ELK", residency: MB, section: "s. 14", implements: GENERAL,
      conditions: ["ca-mb-big-game-draw", "ca-mb-elk-landowner-own-property"],
    },
  },
  SchD: {
    "MANITOBA RESIDENT ARCHERY MOOSE LICENCE": {
      licence: "MB_RESIDENT_ARCHERY_MOOSE", residency: MB, section: "s. 17", implements: ARCHERY, archery: true,
    },
    "MANITOBA RESIDENT DRAW ARCHERY MOOSE LICENCE": {
      licence: "MB_RESIDENT_DRAW_ARCHERY_MOOSE", residency: MB, section: "s. 3.3; Schedule D, Part B", implements: ARCHERY, archery: true,
      conditions: ["ca-mb-big-game-draw"],
    },
    "MANITOBA RESIDENT DRAW GENERAL MOOSE LICENCE": {
      licence: "MB_RESIDENT_DRAW_GENERAL_MOOSE", residency: MB, section: "s. 18", implements: GENERAL,
      conditions: ["ca-mb-big-game-draw"],
    },
    "MANITOBA RESIDENT GENERAL MOOSE LICENCE AND CONSERVATION MOOSE LICENCE": {
      licence: "MB_RESIDENT_GENERAL_MOOSE", residency: MB, section: "s. 19(1)", implements: GENERAL,
    },
    "CANADIAN RESIDENT GENERAL MOOSE LICENCE": {
      licence: "CANADIAN_RESIDENT_GENERAL_MOOSE", residency: CA, section: "s. 19(2)", implements: GENERAL,
      conditions: ["ca-mb-moose-outfitter-guide"],
    },
    "NON-CANADIAN RESIDENT GENERAL MOOSE LICENCE": {
      licence: "NON_CANADIAN_GENERAL_MOOSE", residency: NC, section: "s. 19(3)", implements: GENERAL,
      conditions: ["ca-mb-moose-outfitter-guide"],
    },
  },
  SchF: {
    "MANITOBA RESIDENT GENERAL BLACK BEAR LICENCE AND BLACK BEAR LICENCE (YOUTH)": {
      licence: "MB_RESIDENT_GENERAL_BLACK_BEAR", residency: MB, section: "s. 24",
    },
    "CANADIAN RESIDENT GENERAL BLACK BEAR LICENCE": {
      licence: "CANADIAN_RESIDENT_GENERAL_BLACK_BEAR", residency: CA, section: "s. 24",
    },
    "NON-CANADIAN RESIDENT GENERAL BLACK BEAR LICENCE": {
      licence: "NON_CANADIAN_GENERAL_BLACK_BEAR", residency: NC, section: "s. 24",
      conditions: ["ca-mb-non-canadian-bear-outfitter"],
    },
  },
};

/**
 * Column 3 of Schedules C and D, read into what may be taken and of which
 * species. "1 elk or 1 male moose" is s. 16: an elk licence in area 23 or 23A
 * may also take a male moose, one animal in all — so it opens a moose season
 * as well as an elk one, under the elk licence.
 */
const BAG_PHRASES = {
  "1 elk": [{ speciesId: ELK, animalClass: "ANY" }],
  "1 male elk": [{ speciesId: ELK, animalClass: "MALE_OVER_10_CM" }],
  "1 antlerless elk": [{ speciesId: ELK, animalClass: "ANTLERLESS" }],
  "1 male moose": [{ speciesId: MOOSE, animalClass: "MALE_OVER_10_CM" }],
  "1 elk or 1 male moose": [{ speciesId: ELK, animalClass: "ANY" }, { speciesId: MOOSE, animalClass: "MALE_OVER_10_CM" }],
};

export function readBag(cell, schedule) {
  const text = cell.replace(/\s+/g, " ").trim();
  const takes = BAG_PHRASES[text];
  if (!takes) throw new Error(`Unrecognised bag limit "${text}" in ${schedule}`);
  const expected = schedule === "SchC" ? ELK : MOOSE;
  if (!takes.some((take) => take.speciesId === expected)) throw new Error(`"${text}" in ${schedule} names no ${expected}`);
  return { statedAs: text, takes };
}

/** The schedule a species' own rows live in, and the section fixing its seasonal bag. */
export const SEASON_BAG_SECTION = {
  [ELK]: "Schedule C, Column 3",
  [MOOSE]: "Schedule D, Column 3; s. 20(1)",
};
