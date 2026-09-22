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
