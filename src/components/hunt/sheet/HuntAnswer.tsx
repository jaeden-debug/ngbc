"use client";

import Link from "next/link";
import { useId } from "react";
import ShareHuntButton from "../../hunt-share/ShareHuntButton";
import { huntEvaluationToShareInput } from "../../../lib/hunt-share/from-hunt-evaluation";
import type { CanonicalId } from "../../../lib/content-contract";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import { readableCalendarDay, readableIso } from "../../../lib/hunt/date";
import type { EvaluationState } from "../../../lib/hunt/exploration/hunt-session";
import { partitionEvaluationSources } from "../../../lib/hunt/source-roles";
import type { HuntEvaluation } from "../../../lib/hunt/types";
import HuntQuestion from "../HuntQuestion";
import ReadyToHunt from "../ReadyToHunt";
import styles from "../HuntApp.module.css";

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
 * The part of a regulatory result that says how its seasons are licensed —
 * hunt codes, draws, quotas — where the authority allocates them that way.
 * Read structurally so this view works before and after the engine carries it.
 */
interface AuthorizationLike {
  requirement: string;
  huntCodes: Array<{ code: string; authorityTerm: string; allocation: { authorityTerm: string; quota?: { statedAs: string } }; statedAs: string }>;
  draws: Array<{ cycleId: string; statedAs: string }>;
}

function authorizationOf(result: HuntEvaluation): AuthorizationLike | null {
  return (result.regulation as { authorization?: AuthorizationLike }).authorization ?? null;
}

/**
 * Regulatory availability, never entitlement: which hunts a season is open
 * under and how their licences are issued. North Ground cannot see what anyone
 * holds, and the block ends by saying so.
 */
function AuthorizationBlock({ authorization }: { authorization: AuthorizationLike }) {
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
  const sourceGroups = partitionEvaluationSources(result);
  const authority = sourceGroups.authority[0];
  const checked = readableCalendarDay(result.regulation.verifiedAt);

  return (
    <div className={styles.answer} data-status={status}>
      <p className={styles.answerStatus}>
        <span className="ng-status" data-status={status}>{statusWord(status)}</span>
        {evaluation.kind === "loading" ? <span className={styles.spinner} aria-label="Updating" /> : null}
      </p>
      <p className={styles.answerSummary}>{result.regulation.summary}</p>

      {result.regulation.season || result.regulation.limits ? (
        <dl className={styles.facts}>
          {result.regulation.season ? (
            <div>
              <dt>Season</dt>
              <dd className="ng-numeric">{readableIso(result.regulation.season.opens)} – {readableIso(result.regulation.season.closes)}</dd>
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

      {authorizationOf(result) ? <AuthorizationBlock authorization={authorizationOf(result)!} /> : null}

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
        <AnswerDetail result={result} species={species} placeLabel={placeLabel} jurisdiction={jurisdiction} onAnswer={onAnswer} sourceGroups={sourceGroups} />
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

function AnswerDetail({ result, species, placeLabel, jurisdiction, onAnswer, sourceGroups }: {
  result: HuntEvaluation;
  species: SpeciesSelectorOption | null;
  placeLabel: string | null;
  jurisdiction: { id: CanonicalId<"jurisdiction">; displayName: string } | null;
  onAnswer: (dimensionId: string, value: string) => void;
  sourceGroups: ReturnType<typeof partitionEvaluationSources>;
}) {
  const id = useId();
  const weather = result.weather;
  return (
    <div className={styles.detail}>
      {result.zone.nearBoundary ? (
        <p className={styles.warning} role="note">
          <strong>Close to a zone boundary.</strong>{" "}
          {result.zone.boundaryDistanceMeters !== undefined ? `This point is about ${result.zone.boundaryDistanceMeters.toLocaleString("en-CA")} m from the mapped line. ` : ""}
          Rules can differ on the other side, and consumer GPS is not a legal position fix.
        </p>
      ) : null}

      {result.regulation.requirements.length ? (
        <section aria-labelledby={`${id}-req`}>
          <h3 className={styles.detailTitle} id={`${id}-req`}>Conditions that apply</h3>
          <ul className={styles.bullets}>{result.regulation.requirements.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
      ) : null}

      {result.readiness ? (
        <ReadyToHunt
          readiness={result.readiness}
          speciesMedia={species?.image ?? null}
          speciesName={result.species.name}
          residency={result.input.answers?.RESIDENCY}
          onChooseResidency={(value) => onAnswer("RESIDENCY", value)}
        />
      ) : null}

      <section aria-labelledby={`${id}-time`}>
        <h3 className={styles.detailTitle} id={`${id}-time`}>Legal hunting time</h3>
        <p className={styles.detailText}>{result.regulation.legalTime.text || "Not stated by the certified record."}</p>
      </section>

      {result.regulation.limitations.length ? (
        <section aria-labelledby={`${id}-lim`}>
          <h3 className={styles.detailTitle} id={`${id}-lim`}>What this does not resolve</h3>
          <ul className={styles.bullets}>{result.regulation.limitations.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
      ) : null}

      {weather.status === "AVAILABLE" || weather.summary ? (
        <section aria-labelledby={`${id}-wx`}>
          <h3 className={styles.detailTitle} id={`${id}-wx`}>Weather</h3>
          <p className={styles.detailText}>{weather.summary}</p>
          {weather.status === "AVAILABLE" ? (
            <dl className={styles.facts}>
              {weather.temperatureMaxC !== undefined ? (
                <div><dt>High / low</dt><dd className="ng-numeric">{Math.round(weather.temperatureMaxC)}°C{weather.temperatureMinC !== undefined ? ` / ${Math.round(weather.temperatureMinC)}°C` : ""}</dd></div>
              ) : null}
              {weather.precipitationMm !== undefined ? <div><dt>Precipitation</dt><dd className="ng-numeric">{weather.precipitationMm} mm</dd></div> : null}
              {weather.sunrise ? <div><dt>Sunrise / sunset</dt><dd className="ng-numeric">{weather.sunrise.slice(11, 16)} / {weather.sunset?.slice(11, 16) ?? "—"}</dd></div> : null}
            </dl>
          ) : null}
          <p className={styles.detailNote}>Weather is context and never decides legality. Provider sunrise and sunset are not certified legal hunting times.</p>
        </section>
      ) : null}

      {result.knowledge.blocks.length ? (
        <section aria-labelledby={`${id}-notes`}>
          <h3 className={styles.detailTitle} id={`${id}-notes`}>North Ground field notes</h3>
          {result.knowledge.blocks.map(({ block }) => (
            <div className={styles.note} key={block.id}>
              <span className={styles.noteKind}>{block.type.replaceAll("_", " ")}</span>
              <p>{block.content.plainText}</p>
            </div>
          ))}
          {species ? <p className={styles.detailNote}><Link href={species.resourcePath}>Full {species.displayName.toLowerCase()} profile →</Link></p> : null}
        </section>
      ) : null}

      <section aria-labelledby={`${id}-src`} id="hunt-answer-sources">
        <h3 className={styles.detailTitle} id={`${id}-src`}>Sources</h3>
        {sourceGroups.authority.length ? (
          <>
            <p className={styles.detailNote}>What decided this answer: the rules and the zone boundary.</p>
            <SourceList sources={sourceGroups.authority} />
          </>
        ) : <p className={styles.detailText}>No official source is attached to this answer.</p>}
        {sourceGroups.context.length ? (
          <>
            <p className={styles.detailNote}>Behind the field notes and weather — not the authority for this answer.</p>
            <SourceList sources={sourceGroups.context} />
          </>
        ) : null}
        <p className={styles.detailNote}>
          North Ground organises official information. It does not replace the legislation, regulations or instructions of the
          responsible authority. Confirm current requirements before you hunt.
        </p>
      </section>

      {jurisdiction ? (
        <section aria-labelledby={`${id}-brief`} className={styles.briefBlock}>
          <h3 className={styles.detailTitle} id={`${id}-brief`}>Hunt Brief</h3>
          <p className={styles.detailText}>A dated snapshot of this exact answer, with its sources, that you can send. It never includes your location.</p>
          <ShareHuntButton huntResult={huntEvaluationToShareInput(result, { jurisdiction })} />
        </section>
      ) : null}
      {placeLabel ? <p className={styles.detailNote}>Checked for {placeLabel}.</p> : null}
    </div>
  );
}

function SourceList({ sources }: { sources: HuntEvaluation["sources"] }) {
  return (
    <ul className={styles.sourceList}>
      {sources.map((source) => {
        // When North Ground last read the source — a retrieval date, not a re-verification.
        const retrieved = readableCalendarDay(source.retrievedAt);
        return (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
            <span className={styles.sourceMeta}>
              {source.publisher}{source.verificationStatus ? ` · ${source.verificationStatus}` : ""}{retrieved ? ` · retrieved ${retrieved}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
