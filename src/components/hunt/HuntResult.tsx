"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import ShareHuntButton from "../hunt-share/ShareHuntButton";
import { huntEvaluationToShareInput } from "../../lib/hunt-share/from-hunt-evaluation";
import { speciesById } from "../../lib/hunt/coverage";
import { readableIso } from "../../lib/hunt/date";
import type { HuntEvaluation } from "../../lib/hunt/types";
import styles from "./Hunt.module.css";

/**
 * Consumer wording for the deterministic status.
 *
 * The engine's exact state is kept on the element and in the Hunt Brief. Only the
 * label is softened; "In season, with conditions" and `CONDITIONAL` are the same
 * fact said two ways, and UNKNOWN never becomes anything friendlier.
 */
const STATUS_WORDING: Record<string, string> = {
  OPEN: "In season",
  CLOSED: "Closed",
  CONDITIONAL: "In season, with conditions",
  UNKNOWN: "Not yet verified",
  CONFLICT: "Sources conflict",
  NEEDS_VERIFICATION: "Needs verification",
};

function readableTimestamp(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function HuntResult({
  result, placeLabel, assumptions = [],
}: {
  result: HuntEvaluation;
  placeLabel: string | null;
  /** Self-reported facts this result depended on, in the question's own words. */
  assumptions?: Array<{ question: string; answer: string }>;
}) {
  const species = speciesById(result.species.id);
  const status = result.regulation.status;
  const zoneName = result.zone.officialName ?? null;
  const tabsId = useId();
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasRules =
    result.regulation.requirements.length > 0 ||
    result.regulation.limitations.length > 0 ||
    result.regulation.legalTime.text.length > 0;
  const hasWeather = result.weather.status === "AVAILABLE" || Boolean(result.weather.summary);
  const hasNotes = result.knowledge.blocks.length > 0;
  const hasSources = result.sources.length > 0;

  /* A tab exists only when it has something to say. An empty "Field Notes" tab is
     decoration pretending to be coverage. */
  const tabs = useMemo(
    () =>
      [
        { id: "overview", label: "Overview", present: true },
        { id: "regulations", label: "Regulations", present: hasRules },
        { id: "weather", label: "Weather", present: hasWeather },
        { id: "notes", label: "Field notes", present: hasNotes },
        { id: "sources", label: `Sources (${result.sources.length})`, present: hasSources },
      ].filter((tab) => tab.present),
    [hasRules, hasWeather, hasNotes, hasSources, result.sources.length],
  );

  const [active, setActive] = useState("overview");
  const activeTab = tabs.some((tab) => tab.id === active) ? active : "overview";

  function onTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const move = (next: number) => {
      event.preventDefault();
      const target = tabs[(next + tabs.length) % tabs.length];
      setActive(target.id);
      requestAnimationFrame(() => {
        (event.currentTarget?.querySelector(`#${CSS.escape(`${tabsId}-${target.id}`)}`) as HTMLElement | null)?.focus();
      });
    };
    if (event.key === "ArrowRight") move(index + 1);
    else if (event.key === "ArrowLeft") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(tabs.length - 1);
  }

  const panelProps = (id: string) => ({
    id: `${tabsId}-${id}-panel`,
    role: "tabpanel" as const,
    "aria-labelledby": `${tabsId}-${id}`,
    tabIndex: 0,
    hidden: activeTab !== id,
    ref: (element: HTMLDivElement | null) => { panelRefs.current[id] = element; },
  });

  return (
    <section className={styles.results} aria-labelledby="hunt-result-heading">
      {/* ── Primary answer ─────────────────────────────────────────────── */}
      <div className={`${styles.resultHead} ng-glass-panel`}>
        <div className={styles.resultTopRow}>
          <div>
            <span className="ng-status" data-status={status}>{STATUS_WORDING[status] ?? status}</span>
            <h2 className={styles.resultSpecies} id="hunt-result-heading">{result.species.name}</h2>
            {zoneName ? <p className={styles.resultZone}>{zoneName}</p> : null}
          </div>
          <div className={styles.resultActions}>
            <ShareHuntButton
              huntResult={huntEvaluationToShareInput(result, {
                jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
              })}
            />
          </div>
        </div>

        <dl className={styles.resultFacts}>
          {placeLabel ? (
            <div>
              <dt className="ng-label">Location</dt>
              <dd>{placeLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt className="ng-label">Date</dt>
            <dd className="ng-numeric">{readableIso(result.input.date)}</dd>
          </div>
          {result.regulation.season ? (
            <div>
              <dt className="ng-label">Season dates</dt>
              <dd className="ng-numeric">
                {readableIso(result.regulation.season.opens)} – {readableIso(result.regulation.season.closes)}
              </dd>
            </div>
          ) : null}
          {result.regulation.limits ? (
            <div>
              <dt className="ng-label">Limits (daily / possession)</dt>
              <dd className="ng-numeric">
                {result.regulation.limits.daily} / {result.regulation.limits.possession}
                {result.regulation.limits.combinedWith ? (
                  <span className={styles.sourceMeta}> combined with {result.regulation.limits.combinedWith}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className={styles.resultSummary}>{result.regulation.summary}</p>

        {assumptions.length > 0 ? (
          /* Directly beneath the status, because the status is only true for the
             hunt described here. A different answer can produce a different
             season, or none. */
          <div className={styles.assumptions} role="note">
            <p className={styles.assumptionsTitle}>This answer assumes</p>
            <ul className={styles.assumptionsList}>
              {assumptions.map((assumption) => (
                <li key={assumption.question}>
                  <span>{assumption.question}</span> <strong>{assumption.answer}</strong>
                </li>
              ))}
            </ul>
            <p className={styles.assumptionsNote}>
              You told North Ground this. Nothing here confirms that a licence, tag or
              residency is valid — only the issuing authority can.
            </p>
          </div>
        ) : null}

        {result.zone.nearBoundary ? (
          <p className={styles.boundaryWarning} role="note">
            <strong>Close to a zone boundary.</strong>{" "}
            {result.zone.boundaryDistanceMeters !== undefined
              ? `This point is about ${result.zone.boundaryDistanceMeters.toLocaleString("en-CA")} m from the mapped boundary. `
              : ""}
            Rules can differ on the other side, and consumer GPS is not a legally
            authoritative position fix. Confirm your position before hunting.
          </p>
        ) : null}
      </div>

      {/* ── Detail ─────────────────────────────────────────────────────── */}
      <div className={`${styles.resultDetail} ng-glass-panel`}>
        <div
          className={styles.tabList}
          role="tablist"
          aria-label="Hunt overview sections"
          onKeyDown={onTabKeyDown}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`${tabsId}-${tab.id}`}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={activeTab === tab.id}
              aria-controls={`${tabsId}-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              data-active={activeTab === tab.id || undefined}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div {...panelProps("overview")} className={styles.panel}>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt>Status</dt>
              <dd>{STATUS_WORDING[status] ?? status} <span className={styles.sourceMeta}>({status})</span></dd>
            </div>
            {zoneName ? (
              <div className={styles.detailRow}>
                <dt>Management zone</dt>
                <dd>{zoneName}</dd>
              </div>
            ) : null}
            <div className={styles.detailRow}>
              <dt>Date checked</dt>
              <dd className="ng-numeric">{readableIso(result.input.date)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Record verified</dt>
              <dd>{readableTimestamp(result.regulation.verifiedAt) ?? "Not stated"}</dd>
            </div>
          </dl>
          <p className={styles.contextDisclaimer}>{result.zone.message}</p>
        </div>

        {hasRules ? (
          <div {...panelProps("regulations")} className={styles.panel}>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt>Legal hunting time</dt>
                <dd>{result.regulation.legalTime.status === "RULE_ONLY" ? "Rule only" : "Not available"}</dd>
              </div>
            </dl>
            <p className={styles.contextDisclaimer}>{result.regulation.legalTime.text}</p>

            {result.regulation.requirements.length ? (
              <>
                <h3 className="ng-label">Conditions that apply</h3>
                <ul className={styles.bullets}>
                  {result.regulation.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
                </ul>
              </>
            ) : null}

            {result.regulation.limitations.length ? (
              <>
                <h3 className="ng-label">What this does not resolve</h3>
                <ul className={styles.bullets}>
                  {result.regulation.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {hasWeather ? (
          <div {...panelProps("weather")} className={styles.panel}>
            <p className={styles.resultSummary}>{result.weather.summary}</p>
            {result.weather.status === "AVAILABLE" ? (
              <dl className={styles.detailList}>
                {result.weather.temperatureMaxC !== undefined ? (
                  <div className={styles.detailRow}>
                    <dt>High / low</dt>
                    <dd className="ng-numeric">
                      {Math.round(result.weather.temperatureMaxC)}°C
                      {result.weather.temperatureMinC !== undefined ? ` / ${Math.round(result.weather.temperatureMinC)}°C` : ""}
                    </dd>
                  </div>
                ) : null}
                {result.weather.precipitationMm !== undefined ? (
                  <div className={styles.detailRow}>
                    <dt>Precipitation</dt>
                    <dd className="ng-numeric">{result.weather.precipitationMm} mm</dd>
                  </div>
                ) : null}
                {result.weather.sunrise ? (
                  <div className={styles.detailRow}>
                    <dt>Sunrise / sunset</dt>
                    <dd className="ng-numeric">
                      {result.weather.sunrise.slice(11, 16)} / {result.weather.sunset?.slice(11, 16) ?? "—"}
                    </dd>
                  </div>
                ) : null}
                {result.weather.timezone ? (
                  <div className={styles.detailRow}>
                    <dt>Time zone</dt>
                    <dd>{result.weather.timezone}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <p className={styles.contextDisclaimer}>
              Weather is environmental context and does not determine legality. Provider
              sunrise and sunset times are not certified legal hunting times.
            </p>
          </div>
        ) : null}

        {hasNotes ? (
          <div {...panelProps("notes")} className={styles.panel}>
            {result.knowledge.blocks.map(({ block }) => (
              <div className={styles.knowledgeItem} key={block.id}>
                <span className={styles.knowledgeType}>{block.type.replaceAll("_", " ")}</span>
                <p className={styles.knowledgeBody}>{block.content.plainText}</p>
              </div>
            ))}
            {species ? (
              <p className={styles.contextDisclaimer}>
                <Link href={species.resourcePath}>Full {species.displayName.toLowerCase()} reference →</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {hasSources ? (
          <div {...panelProps("sources")} className={styles.panel}>
            <ul className={styles.sourceList}>
              {result.sources.map((source) => {
                // `retrievedAt` is when North Ground last read the source. It is a
                // retrieval date, not a claim the rule was re-verified that day.
                const retrieved = readableTimestamp(source.retrievedAt);
                return (
                  <li className={styles.sourceItem} key={source.id}>
                    <a className={styles.sourceLink} href={source.url} target="_blank" rel="noreferrer">
                      {source.title} →
                    </a>
                    <span className={styles.sourceMeta}>
                      {source.publisher}
                      {source.verificationStatus ? ` · ${source.verificationStatus}` : ""}
                      {retrieved ? ` · retrieved ${retrieved}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className={styles.contextDisclaimer}>
              North Ground organises official information. It does not replace the
              legislation, regulations or instructions of the responsible authority.
              Confirm current requirements before you hunt.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
