import Link from "next/link";
import { COVERAGE_SUMMARY } from "../../lib/hunt/coverage";
import { EXPLORATION_WORDING } from "../../lib/hunt/exploration/states";
import { officialTermPlural, ZONE_LAYERS } from "../../lib/hunt/zone-layers";
import styles from "./HuntApp.module.css";

/**
 * What Hunt is, what it covers and what its answers mean — server-rendered.
 *
 * It sits in the sheet beneath the two ways to start, so it is in the page for
 * every reader, crawler and answer engine without standing between a hunter
 * and the map. Nothing here is hidden from people: it is one drag or scroll
 * away, where someone who wants to know how the answers are made will look.
 */

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const MEANINGS = ["SEASON_AVAILABLE", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CLOSED", "UNKNOWN"] as const;

export default function HuntAbout() {
  return (
    <section className={styles.about} aria-labelledby="hunt-about-title">
      {/*
        One line to orient, everything else behind a named disclosure. The
        disclosures are <details>, so this is all in the HTML a crawler or a
        reader without JavaScript receives (§29) — collapsed, not absent.
      */}
      <h2 className={styles.aboutTitle} id="hunt-about-title">
        Find your zone, choose what and when, and read the certified rules with their official source.
      </h2>

      <details className={styles.aboutDetails}>
        <summary>How it works</summary>
        <ol className={styles.aboutSteps}>
          <li><strong>Find the official zone.</strong> Use your location, search a town, address or postal code, or tap a zone on the map. Every boundary comes from the authority&apos;s own published map.</li>
          <li><strong>Choose what you&apos;re hunting and the day.</strong> The answer updates as you change either — there is nothing to submit.</li>
          <li><strong>Read the answer and its source.</strong> Seasons, limits and conditions come from the certified regulation, with the official source and the date it was checked. Where the rules turn on you — residency, licence, method — Hunt asks one question at a time.</li>
        </ol>
      </details>

      <details className={styles.aboutDetails}>
        <summary>Where Hunt has official zones</summary>
        <ul className={styles.aboutList}>
          {SERVED.map((layer) => (
            <li key={layer.id}>{layer.jurisdictionName}: {officialTermPlural(layer)}, from {layer.authority}</li>
          ))}
        </ul>
        <p className={styles.aboutText}>{COVERAGE_SUMMARY} A zone drawn on the map is an official boundary; it is not a claim that North Ground has certified the rules inside it, and every zone card says which.</p>
      </details>

      <details className={styles.aboutDetails}>
        <summary>What these words mean</summary>
        <dl className={styles.aboutMeanings}>
          {MEANINGS.map((state) => (
            <div key={state}>
              <dt><span aria-hidden="true">{EXPLORATION_WORDING[state].glyph}</span> {EXPLORATION_WORDING[state].label}</dt>
              <dd>{EXPLORATION_WORDING[state].detail}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details className={styles.aboutDetails}>
        <summary>Your location &amp; privacy</summary>
        <p className={styles.aboutText}>
          Hunt asks for your location only when you press a location button. It is used to find your zone and to show you on
          the map, and it is never stored, put in a link or shared. A shared hunt names the zone, species and day — never
          where you stand. What this browser remembers — your last hunt, recent searches and where the map sat — stays on
          this device, and &ldquo;Start over&rdquo; in the menu clears it.
        </p>
      </details>

      <p className={styles.aboutText}>
        North Ground organises official information and does not replace the responsible authority&apos;s own regulations:
        confirm current requirements before you hunt.
      </p>
      <p className={styles.aboutLinks}>
        <Link href="/hunting/species">Species library</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/">North Ground</Link>
      </p>
    </section>
  );
}
