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

      {/*
        STILL OPEN, and deliberately.

        These want collapsing — the owner is right that they are a wall — but
        `limitations` is one flat `string[]`, and two very different kinds of
        statement are concatenated into it. Québec's `placeNotes` fire only for
        THIS point: "this point is in the part of the zone the ministry marks
        ZSR", where extra cervid measures apply, or "this point is in [named
        territory]… hunting can be prohibited in particular territories". Those
        are true here, today, about where the hunter is standing. Its
        `standingFor` lines are the opposite: true everywhere in the province,
        always.

        Collapsing the array hides the first kind along with the second, and a
        critical statement does not move behind a disclosure to make a screen
        tidier (§41A). Telling them apart by their WORDING — promoting anything
        that starts "This point is in" — is a renderer guessing at legal
        meaning, which fails silently the first time a jurisdiction phrases one
        differently.

        So it stays open until each line carries its own scope from the author
        who wrote it. Then the general ones collapse, the point-specific ones
        move up beside the status, and the authority's own caveats go to
        Sources. Québec already separates the two at authoring time
        (`quebec.ts:483`), so the knowledge exists — it is only lost at this
        boundary.
      */}
      {result.regulation.limitations.length ? (
        <section aria-labelledby={`${id}-lim`}>
          <h3 className={styles.detailTitle} id={`${id}-lim`}>What this does not resolve</h3>
          <ul className={styles.bullets}>{result.regulation.limitations.map((limitation) => <li key={limitation.id}>{limitation.text}</li>)}</ul>
        </section>
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
            {/* A licence can require its attribution line; it is shown verbatim wherever the source is. */}
            {(source as { attribution?: string }).attribution ? (
              <span className={styles.sourceMeta}>{(source as { attribution?: string }).attribution}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
