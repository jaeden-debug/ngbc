/**
 * Wyoming's open hours for big game, as Chapter 2 states them.
 *
 * "Big game, trophy game and small game animals may only be taken from
 * one-half (1/2) hour before sunrise to one-half (1/2) hour after sunset"
 * (Chapter 2, General Hunting Regulation, s. 5(a), dated April 22, 2026). The
 * Wyoming elk builder stops if that sentence changes.
 *
 * Wyoming lies wholly in `America/Denver` (`time-zone.ts`, from 49 CFR § 71.9
 * and the tz table), so a point anywhere in the state has one clock.
 *
 * SCOPE: the species the Wyoming bundle certifies, which today is elk. The
 * sentence covers all big game, but a window is only offered for an animal
 * whose rules North Ground reads from the same instruments; a species added
 * later inherits it by being in the bundle, never by a list here.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import WYOMING_BUNDLE from "../../../../content/regulatory/us-wy-elk-2026.json" with { type: "json" };

export const WYOMING_BIG_GAME_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "Big game, trophy game and small game animals may only be taken from one-half (1/2) hour before sunrise to " +
    "one-half (1/2) hour after sunset.",
  section: "Chapter 2, General Hunting Regulation, s. 5(a)",
  sourceId: "source:us-wy-general-hunting-ch2-2026" as CanonicalId<"source">,
};

const CERTIFIED_SPECIES: ReadonlySet<string> = new Set(
  (WYOMING_BUNDLE.rules as { speciesId: string }[]).map((rule) => rule.speciesId),
);

/** Every hours rule that binds in Wyoming for this species and date: none for a species not certified here. */
export function wyomingHoursRules(speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return CERTIFIED_SPECIES.has(speciesId) ? [WYOMING_BIG_GAME_HOURS] : [];
}

/** Wyoming's legal hunting window at a point. */
export function wyomingLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone | undefined,
): LegalTimeResult | undefined {
  const [rule] = wyomingHoursRules(speciesId, date);
  return rule ? legalTimeFor(rule, point, date, timezone) : undefined;
}
