"use client";

import { scannableIso } from "../../../lib/hunt/date";
import type { NextSeason } from "../../../lib/hunt/regulatory/season";
import type { RegulatoryResult } from "../../../lib/hunt/types";
import styles from "./Answer.module.css";

/**
 * The season, as two labelled dates a hunter can read at arm's length.
 *
 * `Sat, Sep 19, 2026 – Wed, Mar 31, 2027` is complete and unscannable: the
 * weekday is noise, both dates are the same size and shape, and an en dash is
 * the only thing telling the opening from the closing. OPENS and CLOSES make
 * the distinction a word; the day is large, the year quiet.
 *
 * The authority's own name for the segment stays quoted and language-tagged
 * beneath, never translated and never reformatted (§47). It is ABSENT whenever
 * the rules behind the season disagree on it, because that combination is one
 * the ministry never named — nothing takes its place, since inventing a label
 * is attributing a name to an authority that did not write it.
 */
function DateEnd({ label, iso }: { label: string; iso: string }) {
  const { day, year } = scannableIso(iso);
  return (
    <div className={styles.seasonEnd}>
      <span className={styles.seasonLabel}>{label}</span>
      {/*
        The machine-readable day sits in a <time> beside the split rendering, so
        a crawler and an answer engine get the unambiguous date while a hunter
        gets the scannable one (§29).
      */}
      <time className={`${styles.seasonDay} ng-numeric`} dateTime={iso}>{day}</time>
      <span className={`${styles.seasonYear} ng-numeric`}>{year}</span>
    </div>
  );
}

function Arrow() {
  return (
    <svg className={styles.seasonArrow} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
      <path d="M3 9h12m-4.5-4.5L15 9l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SeasonBlock({ season }: { season: NonNullable<RegulatoryResult["season"]> }) {
  return (
    <section className={`${styles.block} ${styles.season}`} aria-labelledby="hunt-season">
      <h3 className={`${styles.blockTitle} ${styles.seasonTitle}`} id="hunt-season">Season</h3>
      <DateEnd label="Opens" iso={season.opens} />
      <Arrow />
      <DateEnd label="Closes" iso={season.closes} />
      {season.label ? (
        <p className={styles.seasonSegment} lang={season.label.lang}>« {season.label.text} »</p>
      ) : null}
    </section>
  );
}

/**
 * When a closed species opens again.
 *
 * A hunter who taps an animal that is not open did not come to be told it is
 * closed — they came to find out when they can go. `NextSeason` is a
 * discriminated union precisely so the four answers cannot share a
 * representation, and each renders as itself here:
 *
 *   SEASON                   real dates, shown exactly like the season block.
 *   DEPENDS_ON_HUNTER        there is a next opening; which one turns on facts
 *                            about the hunter, so no date is stated.
 *   NONE_IN_CERTIFIED_PERIOD nothing further inside what the sources certify —
 *                            a statement about the CERTIFIED PERIOD, not about
 *                            the world, so the horizon date is carried and the
 *                            claim stops there.
 *   NOT_CERTIFIED            North Ground holds no basis for saying. Never
 *                            rendered as "no further season", which would turn
 *                            a gap in coverage into a closure.
 *
 * None of these invents a date by rolling last year's season forward.
 */
export function NextSeasonBlock({ next }: { next: NextSeason }) {
  if (next.kind === "SEASON") {
    return (
      <section className={`${styles.block} ${styles.next}`} aria-labelledby="hunt-next">
        <h3 className={`${styles.blockTitle} ${styles.nextTitle}`} id="hunt-next">Next season</h3>
        <DateEnd label="Opens" iso={next.opens} />
        <Arrow />
        <DateEnd label="Closes" iso={next.closes} />
      </section>
    );
  }

  return (
    <section className={`${styles.block} ${styles.next}`} aria-labelledby="hunt-next">
      <h3 className={`${styles.blockTitle} ${styles.nextTitle}`} id="hunt-next">Next season</h3>
      <p className={styles.nextText}>
        {next.kind === "DEPENDS_ON_HUNTER"
          ? "A further season is published, but which one opens next depends on your licence and how you hunt."
          : next.kind === "NONE_IN_CERTIFIED_PERIOD"
            ? `No further season opens before ${scannableIso(next.through).day}, ${scannableIso(next.through).year}, which is as far as the certified rules run. The authority may publish more after that.`
            : "Not yet published. North Ground holds no certified basis for a next opening here — check with the authority."}
      </p>
    </section>
  );
}
