import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import { pointTimeZone } from "../time-zone.ts";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-nl-2026.json" with { type: "json" };

/**
 * Legal hunting hours in Newfoundland and Labrador — on the Island only, and
 * that restriction is the point of this file.
 *
 * THE RULE IS CERTAIN AND PROVINCE-WIDE. Wild Life Regulations s. 42(2)
 * prohibits hunting big game "during the period commencing one-half hour after
 * sunset on any day … and ending one-half hour before sunrise on the day next
 * following", so the permitted window is half an hour before sunrise to half an
 * hour after sunset. Unlike Nova Scotia, the province does not define sunrise
 * and sunset as a published table — neither word is defined anywhere in the Act
 * or the Regulations — so they are the astronomical events at the hunt location
 * and our astronomy is the right instrument rather than the wrong one.
 *
 * THE CLOCK IS NOT CERTAIN IN LABRADOR, AND A WINDOW IS A WALL-CLOCK TIME.
 * Newfoundland and Labrador is deliberately absent from
 * `SINGLE_ZONE_JURISDICTIONS`: the Island keeps Newfoundland Time throughout,
 * but Labrador does not keep one clock — most of it keeps Atlantic Time while a
 * southeastern coastal strip keeps Newfoundland Time — and North Ground has not
 * certified where that line runs against the 24 Labrador moose areas or the
 * Labrador bear extent. Showing the wrong one of those two clocks would be
 * wrong by thirty minutes at BOTH ends of the window, which is the direction
 * §8 treats as a false claim: a hunter shooting half an hour before it was
 * lawful. So Labrador gets the rule in words and no computed clock, and the
 * bundle records that as a named gap rather than leaving it to be discovered.
 *
 * This is Idaho's shape, for Canada's reason. Idaho splits on 49 CFR § 71.9(a)
 * running along a county boundary and then a river; Newfoundland and Labrador
 * splits on an island. Both resolve the zone rather than the province, because
 * both have units on either side of a line.
 */

const REGULATIONS = "source:ca-nl-wild-life-regulations" as CanonicalId<"source">;

/** s. 42(2), inverted. The prohibition is the source; the window is its complement. */
export const NEWFOUNDLAND_BIG_GAME_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  /* POSITIVE opens BEFORE sunrise — see the note on `beforeSunriseMinutes`.
     This was -30, which opened the window half an hour AFTER sunrise. */
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "A person shall not hunt, take or kill big game during the period commencing one-half hour after sunset on any day " +
    "ending and ending one-half hour before sunrise on the day next following.",
  section: "Wild Life Regulations s. 42(2)",
  sourceId: REGULATIONS,
};

/**
 * The zones this file will compute a clock for: every Island zone, and no other.
 *
 * Derived from the bundle's own groups rather than listed here, so a zone added
 * to a Labrador group can never arrive in the Island set by being typed into
 * one. The three Island groups are the two the bundle scopes to the Island of
 * Newfoundland and the Island caribou group, whose layer is Island-only.
 */
const ISLAND_GROUP_IDS = new Set([
  "regulatory_group:ca-nl-2026-moose-island",
  "regulatory_group:ca-nl-2026-caribou-island",
  "regulatory_group:ca-nl-2026-bear-island",
]);

export const NEWFOUNDLAND_ISLAND_ZONE_IDS: ReadonlySet<string> = new Set(
  (bundleJson as unknown as { groups: Array<{ id: string; zoneIds: string[] }> }).groups
    .filter((group) => ISLAND_GROUP_IDS.has(group.id))
    .flatMap((group) => group.zoneIds),
);

export function newfoundlandLegalTime(
  place: { zoneId?: string; latitude: number; longitude: number; scope?: "POINT" | "ZONE" },
  date: IsoDate,
): LegalTimeResult | undefined {
  /* A zone-scoped question has no point to compute sunrise at, and a window for
     "somewhere in this area" would answer a question nobody asked. */
  if (place.scope === "ZONE") return undefined;
  if (!place.zoneId || !NEWFOUNDLAND_ISLAND_ZONE_IDS.has(place.zoneId)) return undefined;
  /* America/St_Johns is Newfoundland Time. It is correct here because the area
     was proven to be one the orders describe as on the Island of Newfoundland,
     not because it is the province's capital. */
  return legalTimeFor(NEWFOUNDLAND_BIG_GAME_HOURS, place, date, pointTimeZone("America/St_Johns", "POINT_LOOKUP"));
}
