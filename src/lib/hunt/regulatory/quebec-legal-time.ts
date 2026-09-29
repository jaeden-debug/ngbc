/**
 * Québec's legal hunting hours, assembled from the instruments that make them.
 *
 * THERE IS NO "HALF AN HOUR BEFORE SUNRISE TO HALF AN HOUR AFTER SUNSET"
 * SECTION TO CITE. A census of Règlement sur la chasse (C-61.1, r. 12) and
 * Règlement sur les activités de chasse (C-61.1, r. 1) returns no general hours
 * provision and no occurrence of « heures de chasse » at all. Ontario, Alberta
 * and Manitoba each state their hours in one place, and three jurisdictions
 * agreeing is exactly what makes a fourth dangerous: looking for Québec's
 * equivalent section finds nothing, and "nothing found" is one keystroke from
 * "no rule exists".
 *
 * The rule is real and it is built from three provisions:
 *
 *   C-61.1, s. 56   hunting is PROHIBITED except as a regulation permits, and
 *                   such a regulation may fix the period of the day or night.
 *                   So silence closes; it does not open.
 *   C-61.1, s. 1    « nuit » means the period between half an hour after sunset
 *                   and half an hour before sunrise.
 *   r. 12, s. 21    hunting at night is permitted ONLY for hare or rabbit by
 *                   snare, leopard frog, green frog and bullfrog, and raccoon
 *                   with a hound.
 *
 * Read together: for everything else, lawful hunting is confined to the day, and
 * the day is the complement of the defined night — half an hour before sunrise
 * to half an hour after sunset. That is the same 30/30 window Ontario and
 * Manitoba state outright, reached by a different route, and the route matters
 * because of what it leaves behind: s. 21 is a PERMISSION, and for the species
 * it names the window below is not the whole law. See `QUEBEC_NIGHT_PERMISSION`.
 *
 * TWO DEFINITIONS OF « NUIT » LIVE IN C-61.1 AND ONLY ONE IS THIS ONE.
 * s. 30.1 defines night as ONE AND A HALF hours after sunset to one and a half
 * hours before sunrise — three times the offset — and it is scoped by its own
 * opening words to an evidentiary presumption, not to a hunting window.
 * Anything that resolves « nuit » by name rather than by section will
 * eventually pick it up and publish a window an hour wrong at each end.
 *
 * NOT ENCODED, AND DELIBERATELY SO. r. 12, s. 1 subordinates the whole
 * regulation to instruments governing particular territories — réserves
 * fauniques, zecs, pourvoiries with exclusive rights, and the James Bay and
 * Northeastern Québec Agreement territories. Those were not read, so the
 * enumeration above is complete for r. 12 and r. 1 and is NOT complete for
 * Québec. The standing limitation that a zone is not permission to hunt in the
 * territories inside it already says so to a hunter; this says so to the next
 * reader of this file.
 */

import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import {
  intersectLegalTime,
  legalTimeFor,
  legalTimeNotCertified,
  type LegalTimeException,
  type LegalTimeResult,
  type LegalTimeRule,
} from "./legal-time.ts";
import { quebecStatutoryClock } from "./quebec-statutory-time.ts";

const ACT = "source:ca-qc-loi-conservation-faune" as CanonicalId<"source">;
const HUNTING_REGULATION = "source:ca-qc-reglement-chasse" as CanonicalId<"source">;

/**
 * The instruments this module cites, so the window a hunter reads can be taken
 * back to the Éditeur officiel.
 *
 * Carried here rather than in the bundle because they are not what the bundle
 * is: the bundle is the ministry's season tables, read once a year and hashed;
 * these are consolidated legislation with a consolidation date of their own. No
 * `contentHash` is claimed, because North Ground stores none of their text —
 * §8's own-words rule and the standing freeze on storing verbatim Québec
 * legislative text both point the same way, and a hash of something we do not
 * hold would be a provenance claim we cannot honour.
 */
export const QUEBEC_LEGISLATION_SOURCES: SourceRecord[] = [
  {
    id: ACT,
    authority: "Éditeur officiel du Québec",
    title: "Loi sur la conservation et la mise en valeur de la faune, RLRQ c. C-61.1",
    url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/C-61.1",
    publisher: "Gouvernement du Québec",
    retrievedAt: "2026-09-29T12:00:00Z" as SourceRecord["retrievedAt"],
    type: "official",
    jurisdictionIds: ["jurisdiction:ca-qc" as CanonicalId<"jurisdiction">],
    verificationStatus: "verified",
  },
  {
    id: HUNTING_REGULATION,
    authority: "Éditeur officiel du Québec",
    title: "Règlement sur la chasse, RLRQ c. C-61.1, r. 12",
    url: "https://www.legisquebec.gouv.qc.ca/fr/document/rc/C-61.1,%20r.%2012",
    publisher: "Gouvernement du Québec",
    retrievedAt: "2026-09-29T12:00:00Z" as SourceRecord["retrievedAt"],
    type: "official",
    jurisdictionIds: ["jurisdiction:ca-qc" as CanonicalId<"jurisdiction">],
    verificationStatus: "verified",
  },
];

/**
 * The general window, stated as what it is: the complement of a defined night
 * under a prohibition, in North Ground's own words with both provisions cited.
 *
 * §8's model — read, interpret, structure the fact, write it concisely, cite —
 * rather than a quotation, because the fact here is not in any one sentence of
 * the law. It is the join of a prohibition and a definition, and no verbatim
 * extract would state it.
 */
export const QUEBEC_GENERAL_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "Hunting is prohibited at night, and night is defined as the period between half an hour after sunset and half an " +
    "hour before sunrise. Lawful hunting hours are therefore half an hour before sunrise to half an hour after sunset.",
  section: "Loi sur la conservation et la mise en valeur de la faune, CQLR c. C-61.1, ss. 1 and 56; Règlement sur la chasse, CQLR c. C-61.1, r. 12, s. 21",
  sourceId: ACT,
};

/**
 * Wild turkey, narrowed to the morning.
 *
 * r. 12, s. 14, SIXTH PARAGRAPH — not a section of its own. s. 14 is the
 * general "hunting is permitted in accordance with Annexe III" provision and
 * the turkey window is a paragraph inside it, so citing it as "s. 16" or as a
 * standalone section would be citing a provision that does not say this.
 *
 * Ontario narrows spring turkey to 7 p.m. and Québec narrows it to noon. Both
 * end on a clock time the regulation names, which is why the contract carries
 * `SUNRISE_OFFSET_TO_FIXED_CLOSE`: deriving either from the general rule
 * overshoots by hours.
 */
export const QUEBEC_TURKEY_HOURS: LegalTimeRule = {
  basis: "SUNRISE_OFFSET_TO_FIXED_CLOSE",
  beforeSunriseMinutes: 30,
  closesAt: "12:00",
  statedAs: "During a wild turkey season, hunting is permitted only from half an hour before sunrise until noon.",
  section: "Règlement sur la chasse, CQLR c. C-61.1, r. 12, s. 14, para. 6",
  sourceId: HUNTING_REGULATION,
};

/**
 * The species s. 21 permits to be hunted at night, and by what means.
 *
 * Keyed by canonical species id, so no renderer and no rule matches on a name.
 * Only the species Québec actually serves are listed; frogs and raccoon are in
 * s. 21 too and are added here the day either becomes servable, rather than
 * being carried as rows nothing can reach.
 *
 * THE MEANS IS PART OF THE PERMISSION AND IS NEVER DROPPED. s. 21 permits hare
 * and rabbit AT NIGHT BY SNARE. A hare hunter carrying a rifle is bound by the
 * day window exactly like everyone else, and a line that said only "hare may be
 * hunted at night" would be read by the wrong hunter.
 */
const NIGHT_PERMITTED: Readonly<Record<string, string>> = {
  "species:arctic-hare": "by snare",
  "species:snowshoe-hare": "by snare",
  "species:eastern-cottontail": "by snare",
};

/**
 * s. 21's permission, as an exception carried beside the window.
 *
 * WIDENS: for a hunter it reaches, the real window is wider than the one shown.
 * That is the direction §8 calls the quieter failure — a hunter told their
 * lawful snare set is unlawful complains to nobody and simply does not go.
 */
export function quebecNightPermission(speciesId: string): LegalTimeException | null {
  const means = NIGHT_PERMITTED[speciesId];
  if (!means) return null;
  return {
    id: `quebec-night-permission:${speciesId}`,
    text: `Québec permits this species to be hunted at night ${means}. The window above binds every other means; taken ${means}, it does not apply.`,
    effect: "WIDENS",
    section: "Règlement sur la chasse, CQLR c. C-61.1, r. 12, s. 21",
    sourceId: HUNTING_REGULATION,
  };
}

/**
 * Every hours rule that binds for this species on this date.
 *
 * Turkey COMPOSES with the general rule rather than replacing it, for the same
 * reason Ontario's does: s. 56's prohibition and s. 14's window both bind, so
 * the lawful time is their overlap. Here the overlap is always s. 14's — noon
 * precedes sunset plus thirty minutes on every day of a Québec turkey season —
 * which is a fact about the arithmetic, not about the law, and is computed
 * rather than assumed.
 */
export function quebecHoursRules(speciesId: string, _date: IsoDate): LegalTimeRule[] {
  const rules: LegalTimeRule[] = [QUEBEC_GENERAL_HOURS];
  if (speciesId === "species:wild-turkey") rules.push(QUEBEC_TURKEY_HOURS);
  return rules;
}

/**
 * Québec's legal hunting window at a point, for a species and date.
 *
 * A whole-zone question has no answer here, and that is not a gap: a zone spans
 * degrees of longitude and its sunrise differs across it, so the window belongs
 * to a point. `scope: "ZONE"` evaluations pass no usable coordinate and
 * correctly receive NOT_CERTIFIED.
 */
export function quebecLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
): LegalTimeResult {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    return legalTimeNotCertified(
      "Legal hunting time depends on sunrise and sunset at a place. A zone spans too much longitude to have one, so " +
        "North Ground states it for a point rather than for a whole zone.",
      "Gouvernement du Québec",
      ACT,
    );
  }

  const clock = quebecStatutoryClock(point, date);
  if (clock.status !== "RESOLVED") {
    return legalTimeNotCertified(clock.reason, clock.authority, ACT);
  }

  const composed = intersectLegalTime(
    quebecHoursRules(speciesId, date)
      .map((rule) => legalTimeFor(rule, point, date, clock.zone as Parameters<typeof legalTimeFor>[3])),
  );
  if (composed.status !== "RESOLVED") return composed;

  const permission = quebecNightPermission(speciesId);
  return {
    ...composed,
    observedClock: clock.observed,
    ...(permission ? { exceptions: [permission] } : {}),
  };
}
