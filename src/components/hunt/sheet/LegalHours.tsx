"use client";

import type { LegalTimeResult } from "../../../lib/hunt/regulatory/legal-time";
import styles from "../HuntApp.module.css";

/**
 * When it is legal to hunt, as a clock and the rule that produced it.
 *
 * Two lines, because they are two different things: the window a hunter reads
 * off their watch, and the authority's own statement of the rule it came from
 * ("30 minutes before sunrise to 30 minutes after sunset"). Showing only the
 * clock would hide what it depends on; showing only the rule would make
 * someone do sunrise arithmetic in the dark.
 *
 * It is never filled from weather. Provider sunrise and sunset are context and
 * are labelled as such on the weather row; a legal window comes from the
 * regulatory engine or it is not stated.
 *
 * NOT_CERTIFIED is a first-class answer, not an empty block: it says why and
 * names the authority whose rule it is. Québec returns it today because its
 * zones span several timezones, and that is the true answer until the
 * timezone ingest lands — not a gap to paper over.
 */
export default function LegalHours({ legalTime }: { legalTime: LegalTimeResult }) {
  if (legalTime.status === "RESOLVED") {
    return (
      <section className={styles.readyBlock} aria-labelledby="hunt-legal-hours">
        <h3 className={styles.detailTitle} id="hunt-legal-hours">Legal hunting hours</h3>
        <p className={`${styles.legalWindow} ng-numeric`}>
          {legalTime.window.opensAt} – {legalTime.window.closesAt}
          <span className={styles.legalZone}> {legalTime.timezone}</span>
        </p>
        <p className={styles.detailNote}>{legalTime.statedAs}</p>
        {legalTime.precision.marginMinutes ? (
          /* Stated, never implied: the margin is applied INWARD, so a
             calculation error cannot authorise a minute outside the law. */
          <p className={styles.detailNote}>
            Narrowed by {legalTime.precision.marginMinutes} minutes at each end, so a calculation error cannot authorise a minute outside the legal window.
          </p>
        ) : null}
      </section>
    );
  }

  if (legalTime.status === "NO_SOLAR_EVENT") {
    return (
      <section className={styles.readyBlock} aria-labelledby="hunt-legal-hours">
        <h3 className={styles.detailTitle} id="hunt-legal-hours">Legal hunting hours</h3>
        {/* A real answer about a real day, not an error. */}
        <p className={styles.detailText}>
          {legalTime.reason === "SUN_UP_ALL_DAY"
            ? "The sun does not set here on this date, so this rule states no window for it."
            : "The sun does not rise here on this date, so this rule states no window for it."}
        </p>
        <p className={styles.detailNote}>{legalTime.statedAs}</p>
      </section>
    );
  }

  return (
    <section className={styles.readyBlock} aria-labelledby="hunt-legal-hours">
      <h3 className={styles.detailTitle} id="hunt-legal-hours">Legal hunting hours</h3>
      <p className={styles.answerStatus}><span className="ng-status" data-status="UNKNOWN">Not yet verified</span></p>
      <p className={styles.detailText}>{legalTime.reason}</p>
      <p className={styles.detailNote}>{legalTime.authority} states the rule.</p>
    </section>
  );
}
