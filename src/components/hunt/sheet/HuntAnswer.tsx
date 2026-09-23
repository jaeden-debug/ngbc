"use client";

import dynamic from "next/dynamic";
import type { CanonicalId } from "../../../lib/content-contract";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import { readableCalendarDay, readableIso } from "../../../lib/hunt/date";
import type { EvaluationState } from "../../../lib/hunt/exploration/hunt-session";
import type { AuthorizationContext } from "../../../lib/hunt/regulatory/allocation";
import { partitionEvaluationSources } from "../../../lib/hunt/source-roles";
import type { HuntEvaluation } from "../../../lib/hunt/types";
import Disclosure from "./Disclosure";
import LegalHours from "./LegalHours";
import ReadyToHunt from "../ReadyToHunt";
import HuntQuestion from "../HuntQuestion";
import styles from "../HuntApp.module.css";

/* The long form — rules, Ready to Hunt, weather, notes, sources, Hunt Brief —
   is its own chunk, fetched when someone opens it rather than with the map. */
const AnswerDetail = dynamic(() => import("./AnswerDetail"), {
  loading: () => <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Opening the details…</p>,
});

/**
 * The answer for one point, species and day, from the regulatory engine.
 *
 * The status is the engine's own, shown as a word and a glyph. While a
 * question is outstanding the answer IS the question: North Ground knows the
 * law and needs one fact, which is different from not knowing the law. The
 * official source is one tap away from every answer, and nothing here softens
 * UNKNOWN into anything friendlier.
 */

export const STATUS_WORDING: Record<string, string> = {
  OPEN: "In season",
  CLOSED: "Closed",
  CONDITIONAL: "In season, with conditions",
  UNKNOWN: "Not yet verified",
  CONFLICT: "Sources conflict",
  NEEDS_VERIFICATION: "Needs verification",
};

export function statusWord(status: string): string {
  return STATUS_WORDING[status] ?? status;
}

/** How the seasons behind an answer are licensed, in words a hunter uses. */
const AUTHORIZATION_WORDING: Record<string, string> = {
  DRAW_REQUIRED: "Draw required",
  MIXED: "Draw or over-the-counter, by hunt",
  OVER_THE_COUNTER: "Over-the-counter licence",
  GENERAL_LICENCE: "General licence",
};

/**
 * Regulatory availability, never entitlement: which hunts a season is open
 * under and how their licences are issued. North Ground cannot see what anyone
 * holds, and the block ends by saying so.
 */
function AuthorizationBlock({ authorization }: { authorization: AuthorizationContext }) {
  return (
    <div className={styles.assumptions} role="note" aria-label="Licence and hunt">
      <p className={styles.assumptionsTitle}>{AUTHORIZATION_WORDING[authorization.requirement] ?? authorization.requirement}</p>
      <ul>
        {authorization.huntCodes.map((huntCode) => (
          <li key={huntCode.code}>
            <span>{huntCode.authorityTerm}</span> <strong className="ng-numeric">{huntCode.code}</strong>
            {" · "}<span>{huntCode.allocation.authorityTerm}</span>
            {huntCode.allocation.quota ? <span> · {huntCode.allocation.quota.statedAs}</span> : null}
          </li>
        ))}
        {authorization.draws.map((draw) => <li key={draw.cycleId}>{draw.statedAs}</li>)}
      </ul>
      {authorization.huntCodes[0]?.statedAs ? <p className={styles.assumptionsNote}>{authorization.huntCodes[0].statedAs}</p> : null}
    </div>
  );
}

export default function HuntAnswer({
  evaluation, result, species, answered, onAnswer, onRetry, placeLabel, jurisdiction, detailed, onShowDetails,
}: {
  evaluation: EvaluationState;
  /** The result for the CURRENT inputs, or null. Never a result for other inputs. */
  result: HuntEvaluation | null;
  species: SpeciesSelectorOption | null;
  answered: Array<{ question: string; answer: string }>;
  onAnswer: (dimensionId: string, value: string) => void;
  onRetry: () => void;
  placeLabel: string | null;
  jurisdiction: { id: CanonicalId<"jurisdiction">; displayName: string } | null;
  /** Whether the long-form detail is on screen (the sheet is full, or a panel). */
  detailed: boolean;
  onShowDetails: () => void;
}) {
  const loading = evaluation.kind === "loading" || (evaluation.kind === "idle" && !result);

  if (evaluation.kind === "error" && !result) {
    return (
      <div className={styles.answer} role="alert">
        <p className={styles.answerProblem}>
          <strong>This hunt could not be checked.</strong> {evaluation.message} Your zone, species and date are unchanged.
        </p>
        <button type="button" className="ng-action-quiet" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.answer} aria-busy={loading || undefined}>
        <p className={styles.answerLoading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Checking official sources…
        </p>
        <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
      </div>
    );
  }

  if (result.completeness === "NEEDS_INPUT" && result.required) {
    return <HuntQuestion dimension={result.required} answered={answered} onAnswer={onAnswer} disabled={evaluation.kind === "loading"} />;
  }

  const status = result.regulation.status;
  const authority = partitionEvaluationSources(result).authority[0];
  const checked = readableCalendarDay(result.regulation.verifiedAt);

  return (
    <div className={styles.answer} data-status={status}>
      <div className={styles.answerTop}>
        <p className={styles.answerStatus}>
          <span className="ng-status" data-status={status}>{statusWord(status)}</span>
          {evaluation.kind === "loading" ? <span className={styles.spinner} aria-label="Updating" /> : null}
        </p>
        {!detailed ? (
          <button type="button" className={styles.detailsLink} onClick={onShowDetails}>
            Details<span className="ng-visually-hidden">: rules, sources and what you need</span>
          </button>
        ) : null}
      </div>
      {/*
        The facts first, the sentence after.

        The prose used to sit directly under the status, so the first thing a
        hunter read was a paragraph whose every fact is in the list below it —
        the season dates, the limits — plus two things that are not: the
        authority's own name for the season segment ("Armes à feu et à air
        comprimé, arbalète et arc") and the reminder that North Ground has not
        verified what anyone holds.

        Deleting it would take the segment label with it, and that label only
        exists inside this string; it is a real fact with nowhere else to live
        until `season` carries it as a field. So it moves rather than goes:
        status, dates and limits are the scan, and the sentence follows for
        whoever reads on.
      */}
      {result.regulation.season || result.regulation.limits ? (
        <dl className={styles.facts}>
          {result.regulation.season ? (
            <div>
              <dt>Season</dt>
              <dd className="ng-numeric">
                {readableIso(result.regulation.season.opens)} – {readableIso(result.regulation.season.closes)}
                {/*
                  The authority's own name for this segment, quoted and tagged
                  in the language it was published in — never translated, never
                  reformatted (§47).

                  It is ABSENT whenever the rules behind the season disagree on
                  it, because that combination is one the ministry never named.
                  Nothing takes its place: putting a label there would be
                  attributing a name to an authority that did not write it,
                  which is the quiet mirror of inventing a prohibition. An
                  absent segment is the normal case, not a gap.
                */}
                {result.regulation.season.label ? (
                  <span className={styles.factNote} lang={result.regulation.season.label.lang}>
                    {" "}« {result.regulation.season.label.text} »
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {result.regulation.limits ? (
            <div>
              <dt>Daily / possession</dt>
              <dd className="ng-numeric">
                {result.regulation.limits.daily} / {result.regulation.limits.possession}
                {result.regulation.limits.combinedWith ? <span className={styles.factNote}> combined with {result.regulation.limits.combinedWith}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {/*
        The two things a hunter came for, before anything they have to open.

        Legal hours and what they need to carry used to sit behind "Details",
        three screens down, with the answer's prose above them. The owner's
        shape puts them directly under the season, and both are honest wherever
        a jurisdiction has not certified them: a NOT_CERTIFIED window says why
        and names the authority, and a jurisdiction with no checklist says so
        rather than showing an empty table.
      */}
      <LegalHours legalTime={result.regulation.legalTime} />
      {result.readiness ? (
        <ReadyToHunt
          readiness={result.readiness}
          speciesMedia={species?.image ?? null}
          speciesName={result.species.name}
          residency={result.input.answers?.RESIDENCY}
          onChooseResidency={(value) => onAnswer("RESIDENCY", value)}
        />
      ) : null}

      {/*
        Out of the scan, and not deleted.

        The scan is now status → dates → the authority's own segment → limits,
        which is the answer. This sentence still holds two things that are
        nowhere else: the other season segments the record lists (next year's,
        and any this date does not fall in), and the reminder that North Ground
        has not verified what the hunter holds. Deleting it would take those
        with it, so it moves behind a disclosure until each has a home of its
        own — the same rule that kept it on screen before `season.label`
        existed.
      */}
      <Disclosure
        title="Why this answer"
        note="The seasons behind it, and what it does not confirm"
      >
        <p className={styles.answerSummary}>{result.regulation.summary}</p>
      </Disclosure>

      {result.regulation.authorization ? <AuthorizationBlock authorization={result.regulation.authorization} /> : null}

      {answered.length ? (
        <div className={styles.assumptions} role="note">
          <p className={styles.assumptionsTitle}>This answer assumes</p>
          <ul>
            {answered.map((entry) => <li key={entry.question}><span>{entry.question}</span> <strong>{entry.answer}</strong></li>)}
          </ul>
          <p className={styles.assumptionsNote}>You told North Ground this. Nothing here confirms a licence, tag or residency is valid — only the issuing authority can.</p>
        </div>
      ) : null}

      <SourceLine authority={authority} checked={checked} onOpen={onShowDetails} />

      {!detailed ? (
        <button type="button" className={styles.moreButton} onClick={onShowDetails}>
          Rules, sources and what you need
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none"><path d="m3 9 4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : (
        <AnswerDetail result={result} species={species} placeLabel={placeLabel} jurisdiction={jurisdiction} />
      )}
    </div>
  );
}

function SourceLine({ authority, checked, onOpen }: {
  authority: HuntEvaluation["sources"][number] | undefined;
  checked: string | null;
  onOpen: () => void;
}) {
  if (!authority) {
    return <p className={styles.sourceLine} data-missing="true">No official source is attached to this answer, so treat it as unverified.</p>;
  }
  return (
    <button type="button" className={styles.sourceLine} onClick={onOpen}>
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
        <path d="M9 1.6 2.6 4.1v5.1c0 3.7 2.7 6.4 6.4 7.2 3.7-.8 6.4-3.5 6.4-7.2V4.1L9 1.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="m6.4 9 1.9 1.9 3.5-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Official source · {authority.publisher}{checked ? ` · Rules checked ${checked}` : ""}</span>
    </button>
  );
}

