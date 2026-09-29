"use client";

import { useId, useState } from "react";
import { SEASON_OPEN_STROKE } from "../../lib/hunt/exploration/cartography";
import { HEAT_FILL, HEAT_WORDING, SPECIES_LAYER_LEGEND } from "../../lib/hunt/exploration/species-layer";
import type { OpportunityClass } from "../../lib/hunt/intelligence/types";
import styles from "./SpeciesLayerLegend.module.css";

/**
 * The species layer's key.
 *
 * It exists because of §48 and one specific false claim. The layer draws a
 * green outline where a season is open and nothing at all where it is not, and
 * a hunter reading only the colours would conclude that an unhighlighted zone
 * is CLOSED. It is not: it may be a zone North Ground has not certified, or one
 * whose answer turns on who is hunting. A false closure is the failure this
 * whole product exists to avoid, so the sentence saying so is not behind the
 * disclosure — it is on the collapsed chip, always visible.
 *
 * Every heat class carries a word and a bar glyph as well as a tint, and the
 * key states the PEER SET, because the class is a zone's rank against the
 * other zones of the same dataset and never a count of animals.
 */

const RAMP: Array<Exclude<OpportunityClass, "LIMITED_DATA">> = ["VERY_HIGH", "HIGH", "MODERATE", "LOW"];

export default function SpeciesLayerLegend({
  speciesName,
  /** How many zones in view hold heat evidence, and how many wear the green outline. */
  shadedZones,
  openZones,
}: {
  speciesName: string;
  shadedZones: number;
  openZones: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`${styles.legend} ng-glass-overlay`}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
      >
        <span className={styles.summaryTitle}>{speciesName} layer</span>
        <span className={styles.summaryCounts}>
          {openZones} {openZones === 1 ? "zone" : "zones"} in season · {shadedZones} with evidence
        </span>
        {/* Never behind the disclosure: this is the one sentence that prevents a false closure. */}
        <span className={styles.summaryGuard}>A zone without a green outline is not closed.</span>
        <span className={styles.chevron} aria-hidden="true" data-open={open || undefined}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>

      {open ? (
        <div className={styles.panel} id={panelId}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.heatTitle}</h3>
            <ul className={styles.ramp}>
              {RAMP.map((classification) => (
                <li key={classification} className={styles.rampRow}>
                  <span
                    className={styles.swatch}
                    aria-hidden="true"
                    style={{ background: HEAT_FILL[classification].color, opacity: 0.35 + HEAT_FILL[classification].opacity * 2 }}
                  />
                  {/* Words and a bar glyph as well as the tint (§48). */}
                  <span className={styles.rampGlyph} aria-hidden="true">{HEAT_WORDING[classification].glyph}</span>
                  <span className={styles.rampLabel}>{HEAT_WORDING[classification].label}</span>
                </li>
              ))}
              <li className={styles.rampRow}>
                <span className={styles.swatchEmpty} aria-hidden="true" />
                <span className={styles.rampGlyph} aria-hidden="true">{HEAT_WORDING.LIMITED_DATA.glyph}</span>
                <span className={styles.rampLabel}>No shading — no certified evidence held here</span>
              </li>
            </ul>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.heatDetail}</p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.seasonTitle}</h3>
            <p className={styles.seasonRow}>
              <span className={styles.seasonSwatch} aria-hidden="true" style={{ borderColor: SEASON_OPEN_STROKE }} />
              <span>In season across the zone on this date</span>
            </p>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.seasonDetail}</p>
            <p className={styles.guard}>{SPECIES_LAYER_LEGEND.notGreen}</p>
          </section>

          <p className={styles.detail}>{SPECIES_LAYER_LEGEND.independent}</p>
        </div>
      ) : null}
    </div>
  );
}
