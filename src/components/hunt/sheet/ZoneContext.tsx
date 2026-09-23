"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CanonicalId } from "../../../lib/content-contract";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import { readableCalendarDay } from "../../../lib/hunt/date";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState, type SpeciesZoneSummary, type ZoneSummary } from "../../../lib/hunt/exploration/states";
import SpeciesPrimaryImage, { SpeciesImagePlaceholder } from "../../species/SpeciesPrimaryImage";
import styles from "../HuntApp.module.css";

/**
 * What a selected zone says, before and after a species is chosen.
 *
 * Everything here about the rules comes from the zone summary, which asks the
 * same regulatory engine a full Hunt asks — about the WHOLE zone. It never says
 * a zone is open: "In season" is a season running for every licence the rules
 * recognise, "Depends on your hunt" names the fact the engine would ask, and
 * UNKNOWN stays "Not covered here", never closed. A point-level answer needs a
 * point, and this says how to give one.
 */

export type SummaryLoad =
  | { kind: "loading" }
  | { kind: "ready"; summary: ZoneSummary }
  | { kind: "error"; message: string };

export function StateChip({ state }: { state: ZoneState }) {
  const wording = EXPLORATION_WORDING[state];
  return (
    <span className={styles.stateChip} data-state={state}>
      <span aria-hidden="true">{wording.glyph}</span> {wording.label}
    </span>
  );
}

function readableDay(iso: string): string | null {
  return readableCalendarDay(iso);
}

/**
 * "What can I hunt here?" — the zone's certified species as rows, grouped by
 * what the rules say across the zone on the day.
 *
 * A row is the species' own photo, its name, and the season the rules give it
 * — enough to decide without opening anything, which is the point (owner,
 * 2026-09-23). The headings stay the zone vocabulary: a zone card never says
 * OPEN, because nothing here has been told who the hunter is.
 *
 * A closed row carries NO date. The summary knows a season is not running; it
 * does not yet carry when the next one starts, and "closed today" and "closed
 * until further notice" must never share a representation. When the engine
 * carries a next opening, it appears here and nowhere else changes.
 */
const GROUPS: ZoneState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN"];

export function InSeasonHere({ summary, options, onChoose }: {
  summary: ZoneSummary;
  options: SpeciesSelectorOption[];
  onChoose: (id: CanonicalId<"species">) => void;
}) {
  if (summary.counts.jurisdictionSpecies === 0) {
    return (
      <p className={styles.quiet}>
        North Ground has not certified hunting rules in {summary.zone.jurisdictionName} yet. The boundary is official; what applies inside it is not covered.
      </p>
    );
  }
  const byState = new Map<ZoneState, SpeciesZoneSummary[]>();
  for (const entry of summary.species) {
    const list = byState.get(entry.state) ?? [];
    list.push(entry);
    byState.set(entry.state, list);
  }
  const shown = GROUPS.filter((state) => byState.get(state)?.length);
  if (!shown.length) {
    return (
      <p className={styles.quiet}>
        No certified season is running here for every hunter on this day. Choose a species to see why — a gap in coverage is shown as a gap, never as a closed season.
      </p>
    );
  }
  const media = new Map(options.map((option) => [option.id as string, option.image ?? null]));
  const row = (entry: SpeciesZoneSummary) => {
    const opens = entry.season ? readableDay(entry.season.opens) : null;
    const closes = entry.season ? readableDay(entry.season.closes) : null;
    const image = media.get(entry.speciesId) ?? null;
    return (
      <li key={entry.speciesId}>
        <button type="button" className={styles.speciesRow} data-state={entry.state} onClick={() => onChoose(entry.speciesId)}>
          <span className={styles.speciesRowMedia} aria-hidden="true">
            {image ? <SpeciesPrimaryImage media={image} variant="avatar" /> : <SpeciesImagePlaceholder label={entry.name} />}
          </span>
          <span className={styles.speciesRowText}>
            <span className={styles.speciesRowName}>{entry.name}</span>
            {opens && closes ? <span className={styles.speciesRowSeason}>{opens} – {closes}</span> : null}
          </span>
          {/* The state travels with the row as a word for assistive technology,
              and as the glyph the group heading already carries for everyone
              else — never as the colour alone (§40). */}
          <span className="ng-visually-hidden">{EXPLORATION_WORDING[entry.state].label}</span>
          <svg className={styles.speciesRowChevron} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
            <path d="m5 3 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </li>
    );
  };
  return (
    <div className={styles.quickGroups}>
      {shown.map((state) => (
        <div key={state}>
          <p className={styles.quickTitle}>
            <StateChip state={state} />
            {/* A space the layout does not need, so the heading reads as
                "In season 6" wherever this text is copied or extracted. */}
            {" "}
            <span className={styles.count}>{byState.get(state)!.length}</span>
          </p>
          <ul className={styles.speciesRows}>{byState.get(state)!.map(row)}</ul>
        </div>
      ))}
    </div>
  );
}

/** The whole-zone answer for one species, with the way to a point-level answer. */
export function ZoneSpeciesAnswer({ entry, species, summary, zoneLabel, action, onShowDetails }: {
  entry: SpeciesZoneSummary | null;
  species: SpeciesSelectorOption;
  summary: ZoneSummary;
  zoneLabel: string;
  action: ReactNode;
  /** Present while the long form is not on screen. */
  onShowDetails?: () => void;
}) {
  if (!entry) {
    return (
      <div className={styles.answer}>
        <p className={styles.answerStatus}><StateChip state="NOT_CERTIFIED" /></p>
        <p className={styles.answerSummary}>
          North Ground has not certified {species.displayName.toLowerCase()} rules in {summary.zone.jurisdictionName}.
          {" "}{summary.zone.authority} publishes them; nothing here says whether a season is open.
        </p>
        <p className={styles.detailNote}><Link href={species.resourcePath}>{species.displayName} profile →</Link></p>
      </div>
    );
  }
  const wording = EXPLORATION_WORDING[entry.state];
  const until = entry.season ? readableDay(entry.season.closes) : null;
  const areas = entry.exceptInside?.length === 1 ? entry.exceptInside[0] : "the restricted areas listed below";
  const sentence =
    entry.state === "SEASON_AVAILABLE" && until
      ? `The season runs across ${zoneLabel} until ${until} for every licence the rules recognise. Licensing, legal hours and local restrictions still apply.`
      : entry.state === "SEASON_EXCEPT_AREAS"
        ? `The season runs across ${zoneLabel}${until ? ` until ${until}` : ""}, except inside ${areas}, where the authority restricts it. Licensing, legal hours and local restrictions still apply.`
        : entry.state === "CHECK_REQUIREMENTS" && entry.question
          ? `It depends on who is hunting and how. The rules first ask: “${entry.question}”`
          : entry.detail ?? wording.detail;
  return (
    <div className={styles.answer} data-state={entry.state}>
      <div className={styles.answerTop}>
        <p className={styles.answerStatus}><StateChip state={entry.state} /></p>
        {onShowDetails ? (
          <button type="button" className={styles.detailsLink} onClick={onShowDetails}>
            Details<span className="ng-visually-hidden">: everything the rules say about {zoneLabel}</span>
          </button>
        ) : null}
      </div>
      <p className={styles.answerSummary}>{sentence}</p>
      {entry.state === "UNKNOWN" && entry.detail ? <p className={styles.detailNote}>{wording.detail}</p> : null}
      {action}
    </div>
  );
}

/** The long form: every certified species by state, restricted areas, requirements and facts. */
export function ZoneSummaryDetail({ summary, parts }: { summary: ZoneSummary; parts?: number }) {
  const groups: ZoneState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN"];
  return (
    <div className={styles.detail}>
      {summary.counts.certifiedHere > 0 ? (
        <section aria-label="Certified species in this zone">
          <h3 className={styles.detailTitle}>What the certified rules say for the whole zone</h3>
          {groups.map((state) => {
            const entries = summary.species.filter((entry) => entry.state === state);
            if (!entries.length) return null;
            return (
              <div key={state} className={styles.stateGroup}>
                <p className={styles.stateGroupTitle}><StateChip state={state} /> <span className={styles.count}>{entries.length}</span></p>
                <p className={styles.detailText}>{entries.map((entry) => entry.name).join(" · ")}</p>
              </div>
            );
          })}
          <p className={styles.detailNote}>
            “In season” means a season is open for every licence the rules recognise. It is not a licence check, and legal hours and local restrictions still apply.
          </p>
        </section>
      ) : null}

      {summary.specialAreas?.length ? (
        <section aria-label="Restricted areas in this zone">
          <h3 className={styles.detailTitle}>Restricted areas inside this zone</h3>
          <ul className={styles.bullets}>
            {summary.specialAreas.slice(0, 6).map((area) => (
              <li key={`${area.name}|${area.statedAs}`}>
                <strong>{area.name}</strong> — “{area.statedAs}” <span className={styles.factNote}>Affects {area.species.join(", ").toLowerCase()}.</span>
              </li>
            ))}
            {summary.specialAreas.length > 6 ? <li>{summary.specialAreas.length - 6} more — switch them on under Layers to see where they are.</li> : null}
          </ul>
        </section>
      ) : null}

      {summary.requirements.length || summary.pointOnlyChecks ? (
        <section aria-label="Special considerations">
          <h3 className={styles.detailTitle}>Special considerations</h3>
          <ul className={styles.bullets}>
            {summary.requirements.slice(0, 4).map((line) => <li key={line}>{line}</li>)}
            {summary.requirements.length > 4 ? <li>{summary.requirements.length - 4} more in a full check at an exact spot.</li> : null}
            {summary.pointOnlyChecks ? (
              <li>{summary.pointOnlyChecks.charAt(0).toUpperCase() + summary.pointOnlyChecks.slice(1)} inside this zone are checked only at an exact spot.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <dl className={styles.facts}>
        <div><dt>Certified here</dt><dd>{summary.counts.certifiedHere} of {summary.counts.jurisdictionSpecies} species</dd></div>
        <div><dt>Authority</dt><dd>{summary.zone.authority}</dd></div>
        <div><dt>Official name</dt><dd>{summary.zone.officialName}</dd></div>
        {parts && parts > 1 ? <div><dt>Published as</dt><dd>{parts.toLocaleString("en-CA")} parts</dd></div> : null}
        {summary.verifiedAt ? <div><dt>Rules last verified</dt><dd>{readableDay(summary.verifiedAt)}</dd></div> : null}
      </dl>
    </div>
  );
}
