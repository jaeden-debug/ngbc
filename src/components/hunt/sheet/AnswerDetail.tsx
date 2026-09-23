"use client";

import Link from "next/link";
import { useId } from "react";
import ShareHuntButton from "../../hunt-share/ShareHuntButton";
import { huntEvaluationToShareInput } from "../../../lib/hunt-share/from-hunt-evaluation";
import type { CanonicalId } from "../../../lib/content-contract";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import { readableCalendarDay } from "../../../lib/hunt/date";
import { partitionEvaluationSources } from "../../../lib/hunt/source-roles";
import type { HuntEvaluation } from "../../../lib/hunt/types";
import Disclosure from "./Disclosure";
import { groupLimitations, orphanCaveats, sourceCaveats, type LimitationGroups } from "./limitation-groups";
import ReadyToHunt from "../ReadyToHunt";
import styles from "../HuntApp.module.css";

/**
 * Everything behind an answer, for reading: the conditions that apply, what
 * the hunter needs before going, legal time, what the answer does not
 * resolve, weather, field notes, the sources that decided it and the Hunt
 * Brief. Loaded on demand.
 */
export default function AnswerDetail({ result, species, placeLabel, jurisdiction, onAnswer }: {
  result: HuntEvaluation;
  species: SpeciesSelectorOption | null;
  placeLabel: string | null;
  jurisdiction: { id: CanonicalId<"jurisdiction">; displayName: string } | null;
  onAnswer: (dimensionId: string, value: string) => void;
}) {
  const id = useId();
  const sourceGroups = partitionEvaluationSources(result);
  const limitations = groupLimitations(result.regulation.limitations);
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

      {/*
        What applies HERE, today: the lines their authors marked CRITICAL or
        CONTEXTUAL. They sit above everything else and never behind a
        disclosure — a hunter who misses one of these can be stopped, fined or
        hurt, and tidiness is not a reason to hide that (§41A).

        A CONTEXTUAL line arrives only once the evaluation has decided its
        condition, so its presence is the condition holding; nothing here
        re-tests it. If a jurisdiction ever emits a NEAR_BOUNDARY line, it will
        read alongside the boundary warning above rather than replacing it —
        two statements of the same fact is a smaller fault than losing one.
      */}
      {limitations.here.length ? (
        <section aria-labelledby={`${id}-here`} className={styles.warning} role="note">
          <h3 className={styles.detailTitle} id={`${id}-here`}>Applies here today</h3>
          <ul className={styles.bullets}>
            {limitations.here.map((limitation) => (
              <li key={limitation.id} lang={limitation.lang}>
                {limitation.owner === "AUTHORITY" ? `« ${limitation.text} »` : limitation.text}
              </li>
            ))}
          </ul>
        </section>
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

      {/*
        The GENERAL lines: true everywhere this jurisdiction reaches, always.
        Said once, collapsed, complete. Nothing was cut to get here — what left
        this list went UP to "Applies here today" or ACROSS into Sources,
        each because its author said which it was.
      */}
      {limitations.always.length ? (
        <Disclosure
          title="What this does not resolve"
          note="True of every answer in this jurisdiction"
          count={limitations.always.length}
          id={`${id}-lim`}
        >
          <ul className={styles.bullets}>
            {limitations.always.map((limitation) => <li key={limitation.id} lang={limitation.lang}>{limitation.text}</li>)}
          </ul>
        </Disclosure>
      ) : null}

      {weather.status === "AVAILABLE" || weather.summary ? (
        <section aria-labelledby={`${id}-wx`}>
          <h3 className={styles.detailTitle} id={`${id}-wx`}>Weather</h3>
          {/* The prose said the same numbers as the list under it. Where there
              are numbers, the list is the answer; where there are none — beyond
              the forecast range, a provider that did not answer — the sentence
              IS the answer and is the only thing to show. */}
          {weather.status === "AVAILABLE" ? (
            <dl className={styles.facts}>
              {weather.temperatureMaxC !== undefined ? (
                <div><dt>High / low</dt><dd className="ng-numeric">{Math.round(weather.temperatureMaxC)}°C{weather.temperatureMinC !== undefined ? ` / ${Math.round(weather.temperatureMinC)}°C` : ""}</dd></div>
              ) : null}
              {weather.precipitationMm !== undefined ? <div><dt>Precipitation</dt><dd className="ng-numeric">{weather.precipitationMm} mm</dd></div> : null}
              {/* The caveat rides ON the value, where someone reading the time
                  will see it, instead of in a sentence underneath that a hunter
                  scanning for a legal window will skip. */}
              {weather.sunrise ? (
                <div>
                  <dt>Sunrise / sunset<span className={styles.detailNote}> — not a legal hunting time</span></dt>
                  <dd className="ng-numeric">{weather.sunrise.slice(11, 16)} / {weather.sunset?.slice(11, 16) ?? "—"}</dd>
                </div>
              ) : null}
            </dl>
          ) : <p className={styles.detailText}>{weather.summary}</p>}
          <p className={styles.detailNote}>Weather is context and never decides legality.</p>
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

      {/*
        Provenance, one tap away rather than in the scan.

        Safe to collapse where the limitations are not: a citation is never a
        today-here blocker, and the answer keeps its authority and its
        checked-on date up beside the status where a hunter reads them. A
        `<details>` keeps every source in the HTML the server sent, so a
        crawler and an answer engine still receive them (§29) — collapsed is
        not hidden.
      */}
      <Disclosure
        title="Sources"
        note="What decided this answer, and what did not"
        count={sourceGroups.authority.length + sourceGroups.context.length}
        id="hunt-answer-sources"
      >
        {sourceGroups.authority.length ? (
          <>
            <p className={styles.detailNote}>What decided this answer: the rules and the zone boundary.</p>
            <SourceList sources={sourceGroups.authority} caveats={limitations} />
          </>
        ) : <p className={styles.detailText}>No official source is attached to this answer.</p>}
        {sourceGroups.context.length ? (
          <>
            <p className={styles.detailNote}>Behind the field notes and weather — not the authority for this answer.</p>
            <SourceList sources={sourceGroups.context} caveats={limitations} />
          </>
        ) : null}
        {/* A caveat whose source is not listed above is still the authority's
            own statement, and is shown rather than dropped. */}
        {orphanCaveats(limitations, [...sourceGroups.authority, ...sourceGroups.context].map((source) => source.id)).map((caveat) => (
          <blockquote key={caveat.id} className={styles.sourceQuote} lang={caveat.lang}>« {caveat.text} »</blockquote>
        ))}
        <p className={styles.detailNote}>
          North Ground organises official information. It does not replace the legislation, regulations or instructions of the
          responsible authority. Confirm current requirements before you hunt.
        </p>
      </Disclosure>

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

function SourceList({ sources, caveats }: { sources: HuntEvaluation["sources"]; caveats: LimitationGroups }) {
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
            {/* A licence can require its attribution line; it is shown verbatim wherever the source is. */}
            {(source as { attribution?: string }).attribution ? (
              <span className={styles.sourceMeta}>{(source as { attribution?: string }).attribution}</span>
            ) : null}
            {/*
              The authority's own caveat about its own data, with the source it
              is about. It is quoted, attributed and tagged with the language it
              was published in — never translated: §47 keeps an official term in
              the authority's words, and a paraphrase of law presented as the
              ministry's statement is the failure this product exists to avoid.
              An English summary, when one is written, is content someone owns
              and publishes as data — not a sentence a renderer invents.
            */}
            {sourceCaveats(caveats, source.id).map((caveat) => (
              <blockquote key={caveat.id} className={styles.sourceQuote} lang={caveat.lang}>« {caveat.text} »</blockquote>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
