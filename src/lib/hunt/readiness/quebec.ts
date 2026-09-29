import { authorizationRows } from "./requirements.ts";
import { resolveAuthorizations, type HunterAnswers } from "./resolve.ts";
import type {
  AuthorizationRecord, MethodClass, OrangeResult, Provenance, ReadinessResult,
} from "./types.ts";
import bundle from "../../../../content/regulatory/readiness/ca-qc-2026.json" with { type: "json" };

/**
 * Québec's Ready to Hunt — small game, and deliberately only small game.
 *
 * SCOPE IS A CLAIM, SO IT IS NARROW ON PURPOSE. What has been read and
 * certified is the small-game path: the certificat du chasseur, the permis de
 * petit gibier, the separate hare-by-snare licence, and hunter orange. Moose,
 * deer, bear and wild turkey run through different licences, tags and draws
 * that nobody has read, so they get no checklist rather than a checklist built
 * from the nearest thing to hand. A species absent here is a gap in North
 * Ground, and says so.
 *
 * WHAT IS UNRESOLVED IS CARRIED, NOT OMITTED. Two facts a complete checklist
 * would hold are missing and are reported as missing:
 *
 *   METHODS AND AMMUNITION. r. 12 art. 31 defines the engin types precisely,
 *   but WHICH type is permitted for which species in which zone is set by
 *   Annexe III — and Annexe III has no body text on the Éditeur officiel's
 *   consolidated page, only a heading and amendment history. So the engin
 *   VOCABULARY is available and the PERMISSION is not. A specification of an
 *   implement is not a permission to use it, and a season's name is not a
 *   statement of what is permitted, so nothing is derived from either.
 *
 *   FEES. They sit in a separate tarification regulation that has not been
 *   read. §41A forbids showing a fee whose applicability and currentness are
 *   not both established, so every fee here is CHECK_OFFICIAL with the
 *   authority linked. An old or current-looking number is not shown merely
 *   because one was found.
 *
 * Both appear in `limitations`, and `coverage` is PARTIAL rather than
 * VERIFIED, so the checklist reads as partial rather than as complete.
 */

const RECORDS = new Map<string, AuthorizationRecord>(
  (bundle.authorizations as unknown as AuthorizationRecord[]).map((record) => [record.id, record]),
);
const REQUIREMENTS = bundle.requirements as unknown as Record<string, Parameters<typeof resolveAuthorizations>[0]>;
const ORANGE = bundle.orange as unknown as {
  specification: string;
  boundBeyondHunter: string;
  penalty: string;
  snareExemptSpecies: string[];
  unseeableExceptions: string[];
  provenance: Record<"definition" | "duty" | "exemptions" | "penalty", Provenance>;
};

export const QUEBEC_READINESS_SPECIES: readonly string[] = Object.keys(REQUIREMENTS).sort();

/**
 * Hunter orange, Règlement sur les ACTIVITÉS de chasse (C-61.1, r. 1), art. 17.2.
 *
 * THE INSTRUMENT IS r. 1 AND NOT r. 12, WHICH IS THE WHOLE TRAP. r. 12 is the
 * Règlement sur la chasse — the obvious place to look, the one that holds the
 * licences, the engin types and the seasons — and it contains no orange
 * provision at all. A census of its 114,000 characters returns zero
 * occurrences of « orang » and zero of « fluorescent », against 283 for
 * « chasse », so the absence is a real negative rather than an empty fetch.
 * Attributing this rule to r. 12 would be the fifth wrong-instrument finding
 * on this program.
 *
 * FOR SMALL GAME THE ANSWER TURNS ON THE METHOD, and only for hare and
 * cottontail. art. 17.3(1°)(c) exempts arctic hare, snowshoe hare and eastern
 * cottontail taken BY SNARE — the species is in the exemption and the method
 * is the condition, which is exactly the shape a reader skims past. A hare
 * hunter carrying a rifle is bound in full.
 *
 * Grouse reach no exemption at all: art. 17.3(1°)(b) names American crow, rock
 * pigeon and three frogs, and no grouse is among them.
 *
 * THE EXEMPTIONS NORTH GROUND CANNOT SEE ARE LISTED RATHER THAN APPLIED.
 * Several turn on facts about the place or the party — a bow-only sector in a
 * wildlife reserve or zec, a leased territory where everyone present uses a
 * bow, hunting with a bird of prey where nobody carries a weapon, agreement
 * beneficiaries within agreement territories. North Ground holds none of that
 * geography and cannot see who is in the party, so they are surfaced as
 * exceptions the hunter may fall under, never silently resolved either way.
 */
export function quebecOrange(speciesId: string, answers: HunterAnswers): OrangeResult {
  const provenance = [ORANGE.provenance.duty, ORANGE.provenance.definition, ORANGE.provenance.exemptions];
  const snareExempt = ORANGE.snareExemptSpecies.includes(speciesId);
  const method = answers.HUNT_METHOD as MethodClass | undefined;

  if (snareExempt && method === "SNARE") {
    return {
      status: "NOT_REQUIRED",
      summary:
        "Taken by snare, this species is exempt from Québec's hunter-orange requirement. Hunted by any other means, " +
        "the full requirement applies.",
      exceptions: [],
      provenance,
    };
  }

  if (snareExempt && !method) {
    /*
     * The one fact that decides it has not been given. CONDITIONAL with the
     * condition stated — never REQUIRED, which would be stricter than the
     * source for a snare hunter, and never NOT_REQUIRED, which would be
     * looser for everyone else.
     */
    return {
      status: "CONDITIONAL",
      summary:
        "Hunter orange is required unless you are taking this species by snare, which Québec exempts. It depends on " +
        "how you hunt.",
      specification: ORANGE.specification,
      exceptions: [ORANGE.boundBeyondHunter, ...ORANGE.unseeableExceptions],
      provenance,
    };
  }

  return {
    status: "REQUIRED",
    summary: snareExempt
      ? "Hunter orange is required. Québec's exemption for this species covers snaring only, and you are not snaring."
      : "Hunter orange is required for this hunt in Québec's hunting zones.",
    specification: ORANGE.specification,
    exceptions: [ORANGE.boundBeyondHunter, ...ORANGE.unseeableExceptions],
    provenance,
  };
}

/**
 * The checklist for one Québec small-game hunt.
 *
 * `methods` and `ammunition` are ABSENT rather than empty. The contract treats
 * an absent category as "North Ground has not established this", and an empty
 * one would render as a heading with nothing under it — which reads as "no
 * restrictions", the one thing silence must never mean here.
 */
export function resolveQuebecReadiness(
  input: { speciesId: string; date: string; zoneId: string; answers: HunterAnswers },
  _now: Date = new Date(),
): ReadinessResult {
  const requirements = REQUIREMENTS[input.speciesId];
  const base = {
    jurisdictionName: bundle.jurisdictionName,
    officialInfoUrl: bundle.officialInfoUrl,
  };

  if (!requirements) {
    return {
      ...base,
      coverage: "UNAVAILABLE",
      authorizations: [],
      limitations: [
        "North Ground has built a Ready to Hunt checklist for Québec small game only. It has not read the licences, " +
          "tags or draws for this species, so it states nothing about them — check the ministry's own requirements.",
      ],
    };
  }

  const authorizations = resolveAuthorizations(requirements, RECORDS, {
    answers: input.answers,
    /*
     * Québec's big-game licences are not licence-year artefacts and its fees
     * are indexed on 1 April, so a "licence year in force" is the wrong frame
     * here (§41A, amended 2026-09-23). Nothing in this bundle carries a price,
     * so nothing selects on it; the calendar year is passed because the
     * signature needs a number, and it reaches no fee.
     */
    licenceYearToday: Number(input.date.slice(0, 4)),
  });

  return {
    ...base,
    /*
     * PARTIAL, and it is the honest word. The authorizations and hunter orange
     * are certified from the consolidated regulations; methods, ammunition and
     * fees are not. VERIFIED here would tell a hunter the checklist is
     * complete when two of its rows are unknown.
     */
    coverage: "PARTIAL",
    authorizations,
    requirements: authorizationRows(authorizations, bundle.officialInfoUrl),
    orange: quebecOrange(input.speciesId, input.answers),
    limitations: [
      "Legal methods and ammunition are NOT yet covered for Québec. The engin types are defined in the Règlement sur " +
        "la chasse (C-61.1, r. 12, art. 31), but which type is permitted for this species in this zone is set by " +
        "Annexe III, which North Ground has not been able to read. Check the ministry's own requirements before you go.",
      "Fees are NOT shown. Québec sets them in a separate tarification regulation that North Ground has not read, and " +
        "it will not show a fee it cannot confirm is both applicable and current. Check the current official fee.",
      "North Ground cannot check what you hold. Carry your certificat du chasseur and your licence while hunting.",
    ],
  };
}
