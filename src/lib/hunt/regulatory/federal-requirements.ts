/**
 * What federal law requires of a migratory-bird hunter ANYWHERE in Canada.
 *
 * Part 2 of the Migratory Birds Regulations, 2022 needs no geography: it binds
 * wherever migratory game birds are hunted. These are also the requirements
 * hunters are actually charged for missing — a permit without the habitat
 * conservation stamp on it, toxic shot in the bag, a shotgun that holds four.
 *
 * They COMPOSE with provincial requirements and never replace them. A hunter
 * in Alberta needs Alberta's licence AND the federal permit; satisfying one
 * says nothing about the other. §41A already models federal and provincial
 * authorisations composing in one Ready to Hunt list, and these are the federal
 * half.
 *
 * Every line carries its own section so a hunter can read the law itself.
 */

import type { CanonicalId } from "../../content-contract/index.ts";

export type FederalRequirementKind =
  | "AUTHORIZATION"
  | "EQUIPMENT"
  | "METHOD"
  | "TIMING"
  | "CONDUCT";

export interface FederalRequirement {
  id: string;
  kind: FederalRequirementKind;
  /** What a hunter must do, in North Ground's words. */
  summary: string;
  /** The regulation's own words for the binding part. */
  statedAs: string;
  section: string;
  /**
   * Where the regulation itself carves out an exception. Recorded because an
   * unstated exception reads as a stricter rule than the law, and a hunter
   * turned away from a legal hunt is a failure too.
   */
  exceptions?: readonly string[];
  /** Species the requirement does NOT apply to, by canonical id. */
  exceptSpecies?: ReadonlyArray<CanonicalId<"species">>;
}

export const FEDERAL_SOURCE_ID = "source:ca-federal-migratory-birds-regulations" as CanonicalId<"source">;

export const FEDERAL_REQUIREMENTS: readonly FederalRequirement[] = [
  {
    id: "federal_requirement:permit",
    kind: "AUTHORIZATION",
    summary: "Hold a Migratory Game Bird Hunting Permit.",
    statedAs: "A person must not hunt migratory game birds unless authorized by these Regulations.",
    section: "s. 27(1); s. 30(1)",
    exceptions: [
      "The holder of a general hunting licence under the Wildlife Act of the Northwest Territories or of Nunavut may hunt migratory game birds within that territory without a migratory game bird hunting permit (s. 27(2)).",
      "A migratory game bird hunting permit does not allow its holder to hunt a murre unless they are a resident of Newfoundland and Labrador (s. 30(2)).",
    ],
  },
  {
    id: "federal_requirement:habitat-stamp",
    kind: "AUTHORIZATION",
    summary: "A Canadian Wildlife Habitat Conservation Stamp must appear on the permit.",
    statedAs:
      "A person must not hunt migratory game birds under a migratory game bird hunting permit unless a habitat conservation stamp that is authorized by the Minister appears on the permit.",
    section: "s. 31(1)",
  },
  {
    id: "federal_requirement:permit-expiry",
    kind: "AUTHORIZATION",
    summary: "The permit expires on June 30 following the date it was issued.",
    statedAs: "A migratory game bird hunting permit expires on June 30 following the date of issue.",
    section: "s. 33",
  },
  {
    id: "federal_requirement:permit-on-person",
    kind: "CONDUCT",
    summary: "Carry the permit while hunting.",
    statedAs:
      "The holder of a migratory game bird hunting permit must have the permit on their person while they are hunting.",
    section: "s. 34(1)",
  },
  {
    id: "federal_requirement:minors",
    kind: "AUTHORIZATION",
    summary:
      "A minor pays no fee for the permit or the stamp, and must be accompanied by an adult permit holder who has held one before; that adult may accompany at most two minors at a time.",
    statedAs:
      "A minor who holds a permit referred to in subsection (1) must not hunt migratory game birds unless they are accompanied by an individual who (a) is the holder of a migratory game bird hunting permit; (b) has held such a permit in a previous year; and (c) is not a minor.",
    section: "s. 32(1) to (3)",
  },
  {
    id: "federal_requirement:hours",
    kind: "TIMING",
    summary:
      "Hunting is prohibited from half an hour after sunset to half an hour before sunrise south of 60°N, and from one hour after sunset to one hour before sunrise north of 60°N.",
    statedAs:
      "A person must not hunt a migratory game bird (a) north of 60° north latitude during the period commencing one hour after sunset on any day and ending one hour before sunrise on the next day; or (b) south of 60° north latitude during the period commencing half an hour after sunset on any day and ending half an hour before sunrise on the next day unless otherwise specified in Schedule 3.",
    section: "s. 28(3)",
    exceptions: ["Schedule 3 may specify otherwise for a particular area."],
  },
  {
    id: "federal_requirement:non-toxic-shot",
    kind: "EQUIPMENT",
    summary: "Use non-toxic shot, and carry no other shot in the hunting area.",
    statedAs:
      "A person must not hunt a migratory game bird (a) while having in their possession in the hunting area shot other than non-toxic shot; or (b) using shot other than non-toxic shot.",
    section: "s. 38(1)",
    exceptions: [
      "Does not apply to hunting American Woodcock, Band-tailed Pigeon, Murres or Eurasian Collared-Dove (s. 38(2)).",
      "Does not apply to hunting Mourning Dove in British Columbia (s. 38(3)).",
    ],
    /* Only the excepted species North Ground's library holds. */
    exceptSpecies: ["species:american-woodcock"] as ReadonlyArray<CanonicalId<"species">>,
  },
  {
    id: "federal_requirement:shotgun-capacity",
    kind: "EQUIPMENT",
    summary:
      "A shotgun must be no larger than 10 gauge and hold no more than three cartridges; no detachable magazine holding more than two.",
    statedAs:
      "A person must not, while hunting migratory game birds, have in their possession in the hunting area (a) a shotgun that is holding more than three cartridges; or (b) a detachable magazine capable of holding more than two cartridges.",
    section: "s. 37(1)(c), s. 37(2)",
  },
  {
    id: "federal_requirement:one-shotgun",
    kind: "EQUIPMENT",
    summary: "Carry one shotgun; any additional one must be unloaded and disassembled or cased.",
    statedAs:
      "A person must not, while hunting migratory game birds, have in their possession in the hunting area (a) more than one shotgun, unless each additional shotgun is unloaded and either disassembled or kept in a closed case.",
    section: "s. 37(3)",
  },
  {
    id: "federal_requirement:archery-equipment",
    kind: "EQUIPMENT",
    summary:
      "A bow must draw at least 18 kg and a crossbow at least 45 kg, with a broadhead of at least two sharp blades and at least 22 mm wide.",
    statedAs:
      "A person must not hunt migratory game birds except with (a) a bow that has a minimum draw weight of 18 kg and an arrow with a broadhead that has at least two sharp blades and is a minimum of 22 mm wide; (b) a crossbow that has a minimum draw weight of 45 kg and a bolt with a broadhead that has at least two sharp blades and is a minimum of 22 mm wide.",
    section: "s. 37(1)(a) and (b)",
  },
  {
    id: "federal_requirement:no-single-projectile",
    kind: "METHOD",
    summary: "Do not hunt with a shotgun loaded with a single projectile.",
    statedAs:
      "A person must not hunt a migratory game bird using a shotgun loaded with a cartridge containing a single projectile.",
    section: "s. 37(4)",
    exceptions: [
      "A resident of the Northwest Territories who may hunt there without a permit, and a resident of Quebec hunting north of 50°N who may hunt there without a permit, may use a rifle of not more than 0.22 inches or a single projectile (s. 37(5)).",
    ],
  },
  {
    id: "federal_requirement:baiting",
    kind: "METHOD",
    summary:
      "Do not hunt within 400 m of a place where bait has been deposited, unless it has been free of bait for at least seven days.",
    statedAs:
      "A person must not hunt for migratory game birds within a radius of 400 m from any place where bait has been deposited unless the place has been free of bait for at least seven days.",
    section: "s. 36(1)",
    exceptions: [
      "Standing crops, flooded harvested cropland, crops in upright sheaves drying where they grew, and grain scattered solely by normal agricultural or harvesting operations are not baited areas (s. 36(2)).",
    ],
  },
];

/**
 * The federal requirements that apply to hunting this species.
 *
 * A requirement the regulation excepts for a species is REMOVED rather than
 * shown with a footnote: telling a woodcock hunter they must use non-toxic
 * shot is a stricter rule than the law, and a hunter turned away from a legal
 * hunt is a failure too.
 */
export function federalRequirementsFor(speciesId: string): readonly FederalRequirement[] {
  return FEDERAL_REQUIREMENTS.filter(
    (requirement) => !(requirement.exceptSpecies as readonly string[] | undefined)?.includes(speciesId),
  );
}

/**
 * The federal legal-hours rule at a latitude, which s. 28(3) states exactly
 * enough to compute: the margin either side of sunset and sunrise.
 */
export function federalHuntingMargin(latitude: number): { minutes: number; statedAs: string } {
  return latitude > 60
    ? { minutes: 60, statedAs: "one hour after sunset to one hour before sunrise, north of 60°N" }
    : { minutes: 30, statedAs: "half an hour after sunset to half an hour before sunrise, south of 60°N" };
}
