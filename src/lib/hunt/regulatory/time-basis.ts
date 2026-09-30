import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { platformOffsetMinutes } from "./observed-clock.ts";

/**
 * What clock each served jurisdiction keeps, and on whose authority.
 *
 * WHY THIS FILE EXISTS. `manitoba-legal-time.ts` asserted its time basis in a
 * comment — "Manitoba observes Central Time province-wide with daylight saving,
 * so no Atikokan-style divergence arises here." It was true when written and
 * became false when the province moved to permanent daylight time, and nothing
 * failed, because a comment cannot fail. Every Manitoba hunting-hours answer
 * printed an hour early until a hunter would have been in the field with a rifle
 * before it was legal.
 *
 * A time basis in prose and a time basis that was checked look identical. This
 * makes them different: each entry names the instrument or authority that
 * establishes it and the date a person last read that authority, the way a rule
 * carries its provenance. A stale `verifiedAgainstAuthority` is then visible
 * rather than implied, which is most of the value — it converts a silent
 * assumption into a dated claim someone can question.
 *
 * WHAT THE ASSERTION BELOW CAN AND CANNOT CATCH, stated plainly so nobody later
 * mistakes it for the wider guarantee:
 *
 *   IT CATCHES the platform's tz database moving underneath us. If a runtime
 *   upgrade changes what a zone does, the declared basis and the observed
 *   behaviour part company and a test fails.
 *
 *   IT CANNOT CATCH the law moving while tzdata stays put — which is exactly
 *   what Manitoba did. To detect that you need the law's offset from a source
 *   that is not tzdata, and the only such source is the legislature. That is a
 *   person reading a statute, and no assertion here can stand in for it.
 *
 * An automatic detector that cannot detect the thing that actually happened
 * would be worse than none, because it would look like coverage.
 */

export type ClockBasis =
  /** Standard time in winter, daylight time in summer, on the usual dates. */
  | "SEASONAL_DAYLIGHT"
  /** Daylight time all year; clocks never fall back. */
  | "PERMANENT_DAYLIGHT"
  /** Standard time all year; clocks never spring forward. */
  | "PERMANENT_STANDARD";

export interface JurisdictionTimeBasis {
  jurisdictionId: CanonicalId<"jurisdiction">;
  /** The zone Hunt resolves points in this jurisdiction to. */
  timeZone: string;
  basis: ClockBasis;
  /** The instrument where there is one, or the authority that states it. */
  establishedBy: string;
  /** Where that was read, or would be read. */
  sourceUrl: string;
  /**
   * Whether the authority ITSELF was read, or whether this row is an assertion.
   *
   * The whole point of the file. VERIFIED means someone opened the instrument
   * named above on that date. ASSERTED means the basis is believed and has not
   * been checked at the source, and says why — an authority that refuses our
   * agent is a different problem from one nobody has got to yet, and both are
   * different from "we checked".
   *
   * Back-filling a date for a row nobody read would be the exact sin this file
   * exists to prevent, in the file that exists to prevent it.
   */
  verification:
    | { status: "VERIFIED"; on: IsoDate }
    | { status: "ASSERTED"; reason: string };
  /**
   * The offset the platform should show in January and in July, in minutes.
   *
   * Two probes because they separate the three bases: a seasonal zone differs
   * between them, and the two permanent bases do not differ at all.
   */
  expected: { january: number; july: number };
  /** Anything a reader of this row needs that the fields cannot carry. */
  note?: string;
}

/*
 * Jurisdictions Hunt serves a zone layer for. A jurisdiction without a layer
 * cannot produce a legal window, so it has no clock to get wrong yet.
 */
export const JURISDICTION_TIME_BASIS: readonly JurisdictionTimeBasis[] = [
  {
    jurisdictionId: "jurisdiction:ca-mb" as CanonicalId<"jurisdiction">,
    timeZone: "America/Winnipeg",
    basis: "PERMANENT_DAYLIGHT",
    establishedBy:
      "The Official Time Amendment Act, S.M. 2023, c. 4, amending The Official Time Act, C.C.S.M. c. O30; in force 31 October 2026 by proclamation signed 23 September 2026.",
    sourceUrl: "https://web2.gov.mb.ca/laws/statutes/proclamations/2023c4(2026-10-31).php",
    verification: { status: "VERIFIED", on: "2026-09-30" as IsoDate },
    /* The LAW's offsets, which is why January disagrees with the platform and
       why `observed-clock.ts` holds an override. This row states what is true,
       not what the runtime does. */
    expected: { january: -300, july: -300 },
    note:
      "The platform's tz database has not carried this change; see OBSERVED_CLOCK_OVERRIDES. The override renders the clock at the offset the proclamation requires and retires itself when tzdata agrees.",
  },
  {
    jurisdictionId: "jurisdiction:ca-yt" as CanonicalId<"jurisdiction">,
    timeZone: "America/Whitehorse",
    basis: "PERMANENT_DAYLIGHT",
    establishedBy:
      "Interpretation Act, R.S.Y. 2002, c. 125, as amended by the Interpretation Amendment Act (2020); Yukon Standard Time is UTC−7 year-round, adopted 1 November 2020.",
    sourceUrl: "https://laws.yukon.ca/cms/images/LEGISLATION/PRINCIPAL/2002/2002-0125/2002-0125.pdf",
    verification: {
      status: "ASSERTED",
      reason:
        "laws.yukon.ca returns 403 to North Ground's agent, so the Act itself has not been read here. The offset is uncontroversial and the platform agrees, but agreement with tzdata is not verification — it is the coincidence this file exists to stop counting as a check.",
    },
    expected: { january: -420, july: -420 },
  },
  {
    jurisdictionId: "jurisdiction:ca-sk" as CanonicalId<"jurisdiction">,
    timeZone: "America/Regina",
    basis: "PERMANENT_STANDARD",
    establishedBy: "The Time Act, R.S.S. 1978, c. T-14: Central Standard Time throughout the year.",
    sourceUrl: "https://publications.saskatchewan.ca/api/v1/products/1587/formats/2658/download",
    verification: {
      status: "ASSERTED",
      reason:
        "The cited Act is very likely superseded: Saskatchewan announced in April 2026 that it was REPLACING The Time Act. The offset is unaffected — the province keeps UTC-6 either way — but the citation is stale until the replacing instrument is read, and a row that carried a verification date would have enshrined the wrong Act while looking checked.",
    },
    expected: { january: -360, july: -360 },
  },
  {
    jurisdictionId: "jurisdiction:ca-on" as CanonicalId<"jurisdiction">,
    timeZone: "America/Toronto",
    basis: "SEASONAL_DAYLIGHT",
    establishedBy: "Time Act, R.S.O. 1990, c. T.9, s. 2.",
    sourceUrl: "https://www.ontario.ca/laws/statute/90t09",
    verification: { status: "ASSERTED", reason: "Not read at the source in this sweep. The platform agrees with the declared basis, which is not the same as having checked." },
    expected: { january: -300, july: -240 },
    note:
      "Atikokan and a few western communities keep Eastern Standard Time all year; that divergence is handled by statutory-time.ts, which is a different question from this one.",
  },
  {
    jurisdictionId: "jurisdiction:ca-qc" as CanonicalId<"jurisdiction">,
    timeZone: "America/Toronto",
    basis: "SEASONAL_DAYLIGHT",
    establishedBy: "Legal Time Act, CQLR c. T-5.1, s. 2 and s. 4.",
    sourceUrl: "https://www.legisquebec.gouv.qc.ca/en/document/cs/T-5.1",
    verification: { status: "ASSERTED", reason: "Not read at the source in this sweep. The platform agrees with the declared basis, which is not the same as having checked." },
    expected: { january: -300, july: -240 },
    note: "West of the 63rd meridian only; east of it Québec is Atlantic, which quebec-statutory-time.ts resolves.",
  },
  {
    jurisdictionId: "jurisdiction:ca-ab" as CanonicalId<"jurisdiction">,
    timeZone: "America/Edmonton",
    basis: "PERMANENT_DAYLIGHT",
    establishedBy:
      "Daylight Saving Time Act, RSA 2000 c. D-5, as amended by the Red Tape Reduction Statutes Amendment Act, 2026, SA 2026 c. 12, s. 3; proclaimed in force 18 June 2026. The province calls the result Alberta Time, UTC-6 year-round.",
    sourceUrl: "https://www.alberta.ca/proclamations",
    verification: { status: "VERIFIED", on: "2026-09-30" as IsoDate },
    expected: { january: -360, july: -360 },
    note:
      "Found by this sweep, not by a report: our own output stepped from 08:03 on 31 October to 07:05 on 1 November at Edmonton, which is an hour of clock rather than an hour of sun. The platform's tz database still returns to Mountain Standard Time, so OBSERVED_CLOCK_OVERRIDES carries Alberta too.",
  },
  {
    jurisdictionId: "jurisdiction:ca-bc" as CanonicalId<"jurisdiction">,
    timeZone: "America/Vancouver",
    basis: "SEASONAL_DAYLIGHT",
    establishedBy: "Interpretation Act, RSBC 1996, c. 238, s. 32.",
    sourceUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96238_01",
    verification: { status: "ASSERTED", reason: "Not read at the source in this sweep. The platform agrees with the declared basis, which is not the same as having checked." },
    expected: { january: -480, july: -420 },
    note:
      "British Columbia legislated permanent daylight time in 2019 but has not brought it into force, pending its neighbours. Until it does, the seasonal basis is the one in effect — a case where the legislature has moved and the clock has not, which is the mirror of Manitoba.",
  },
];

/** The declared basis for a jurisdiction, or null where none has been recorded. */
export function timeBasisFor(jurisdictionId: string): JurisdictionTimeBasis | null {
  return JURISDICTION_TIME_BASIS.find((entry) => entry.jurisdictionId === jurisdictionId) ?? null;
}

export interface BasisDisagreement {
  jurisdictionId: string;
  timeZone: string;
  month: "january" | "july";
  declared: number;
  platform: number;
}

/**
 * Where the platform's tz database disagrees with a declared basis.
 *
 * Manitoba is expected to appear here and only Manitoba: its override exists
 * precisely because the two disagree. Any OTHER jurisdiction appearing means
 * the tz database changed under us, which is the failure this can catch.
 */
export function basisDisagreements(): BasisDisagreement[] {
  const found: BasisDisagreement[] = [];
  for (const entry of JURISDICTION_TIME_BASIS) {
    for (const [month, date] of [["january", "2027-01-15"], ["july", "2027-07-15"]] as const) {
      const platform = platformOffsetMinutes(entry.timeZone, date as IsoDate);
      const declared = entry.expected[month];
      if (platform !== declared) {
        found.push({ jurisdictionId: entry.jurisdictionId, timeZone: entry.timeZone, month, declared, platform });
      }
    }
  }
  return found;
}
