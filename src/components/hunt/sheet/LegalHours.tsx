"use client";

import type { LegalTimeResult } from "../../../lib/hunt/regulatory/legal-time";
import Disclosure from "./Disclosure";
import AuthorityText from "./AuthorityText";
import styles from "./Answer.module.css";

/**
 * When it is legal to hunt: the clock first, then the rule that produced it.
 *
 * Two different things, and both are kept. The window a hunter reads off their
 * watch is what they came for and goes first, large. The authority's own
 * statement of the rule sits under it, because a clock with nothing behind it
 * hides what it depends on — and because the rule is the part that stays true
 * tomorrow.
 *
 * NEVER FILLED FROM WEATHER. A provider's sunrise and sunset are environmental
 * context, labelled as such on the weather row; a legal window comes from the
 * regulatory engine or it is not stated (§42).
 *
 * THE CLOCK SHOWN IS THE ONE TO FOLLOW, which is §41A's Atikokan rule. Where
 * the statutory basis and the locally observed clock are known to be the same,
 * the window is directly actionable and nothing is said about conversion. Where
 * North Ground cannot place the point's observed clock, the window is still the
 * legal truth and the difference is stated rather than quietly presented as a
 * local reading. The hunter is never asked to do the conversion themselves.
 *
 * NOT_CERTIFIED is a first-class answer, not an empty block: it says why and
 * names the authority whose rule it is.
 */
export default function LegalHours({ legalTime }: { legalTime: LegalTimeResult }) {
  if (legalTime.status === "RESOLVED") {
    const observed = legalTime.observedClock;
    return (
      <section className={styles.block} aria-labelledby="hunt-legal-hours">
        <h3 className={styles.blockTitle} id="hunt-legal-hours">Legal hunting hours</h3>
        <p className={styles.hoursWindow}>
          <span className={`${styles.hoursClock} ng-numeric`}>
            {legalTime.window.opensAt} – {legalTime.window.closesAt}
          </span>
          {/*
            The zone is named where it is a real reading, and suppressed where
            it is a fixed-offset placeholder (`Etc/GMT+5`) that would read to a
            hunter as a timezone they have never heard of. The offset is the
            statute's; the label is not a fact they need.
          */}
          {observed?.status === "SAME_AS_STATUTORY"
            ? <span className={styles.hoursZone}>local time</span>
            : <span className={styles.hoursZone}>{legalTime.timezone}</span>}
        </p>
        <p className={styles.hoursRule}>{legalTime.statedAs}</p>

        {/*
          An exception in force that the window does not express — §9 says
          surface an important exception directly, and this is never collapsed.
          A WIDENS exception is the one a hunter is most likely to be wrongly
          denied by; a NARROWS one is the one they can be charged under.
        */}
        {legalTime.exceptions?.map((exception) => (
          <p className={styles.hoursException} key={exception.id}>
            <strong>{exception.effect === "WIDENS" ? "Wider for some hunts. " : "Narrower for some hunts. "}</strong>
            {exception.text} <span className={styles.hoursNote}>({exception.section})</span>
          </p>
        ))}

        {/*
          The provenance and the arithmetic, one tap down. Neither changes what
          a hunter may do today, so both are safe to collapse where the
          exception above is not — and a `<details>` keeps them in the HTML the
          server sent, so a crawler still receives them (§29).
        */}
        <Disclosure title="Details and exceptions" note="Where this window comes from" id="hunt-legal-hours-detail">
          <p className={styles.hoursRule}>{legalTime.section}</p>
          {observed && observed.status !== "SAME_AS_STATUTORY" ? (
            <p className={styles.hoursRule}>{observed.reason}</p>
          ) : null}
          {observed?.status === "SAME_AS_STATUTORY" ? (
            <p className={styles.hoursNote}>{observed.statedAs}</p>
          ) : null}
          {legalTime.precision.marginMinutes ? (
            /* Stated, never implied: the margin is applied INWARD, so a
               calculation error cannot authorise a minute outside the law. */
            <p className={styles.hoursNote}>
              Narrowed by {legalTime.precision.marginMinutes} minutes at each end, so a calculation error cannot
              authorise a minute outside the legal window.
            </p>
          ) : null}
        </Disclosure>
      </section>
    );
  }

  if (legalTime.status === "NO_SOLAR_EVENT") {
    return (
      <section className={styles.block} aria-labelledby="hunt-legal-hours">
        <h3 className={styles.blockTitle} id="hunt-legal-hours">Legal hunting hours</h3>
        {/* A real answer about a real day, not an error. */}
        <p className={styles.hoursRule}>
          {legalTime.reason === "SUN_UP_ALL_DAY"
            ? "The sun does not set here on this date, so this rule states no window for it."
            : "The sun does not rise here on this date, so this rule states no window for it."}
        </p>
        <p className={styles.hoursNote}>{legalTime.statedAs}</p>
      </section>
    );
  }

  return (
    <section className={styles.block} aria-labelledby="hunt-legal-hours">
      <h3 className={styles.blockTitle} id="hunt-legal-hours">Legal hunting hours</h3>
      <p><span className="ng-status" data-status="UNKNOWN">Not yet verified</span></p>
      {/* The refusal can be the authority's OWN words, in its own language —
          Québec's wild-turkey hours are the ministry's French sentence. A
          hunter must not need French to read a legal-hours answer, and the
          ministry's sentence must not be rewritten, so the reading is shown
          with the original one control away. */}
      <p className={styles.hoursRule}>
        <AuthorityText text={{ text: legalTime.reason, lang: legalTime.reasonLang ?? "en-CA", owner: legalTime.reasonOwner ?? "NORTH_GROUND" }} />
      </p>
      <p className={styles.hoursNote}>{legalTime.authority} states the rule.</p>
    </section>
  );
}
