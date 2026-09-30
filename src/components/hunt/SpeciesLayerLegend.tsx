"use client";

import { useId, useState } from "react";
import { SEASON_OPEN_STROKE } from "../../lib/hunt/exploration/cartography";
import { CONDITION_GLYPH, SPECIES_LAYER_LEGEND } from "../../lib/hunt/exploration/species-layer";
import type { ScopedCondition } from "../../lib/hunt/exploration/condition-scope";
import { notDrawnExplanation } from "../../lib/hunt/exploration/surface-request";
import type { SpeciesSurfaceState } from "../../lib/hunt/exploration/surface-request";
import AuthorityText from "./sheet/AuthorityText";
import { INTERFACE_LANGUAGE } from "../../lib/hunt/translation";
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
 * The evidence half describes the species SURFACE drawn under the zones, in
 * the surface's own words. Zones are never filled with evidence; where a
 * species has only zone-level figures, the key says there is no fine-grained
 * surface rather than painting a zone as if the animals stopped at its line.
 */


/**
 * What to call a layer, from what it IS rather than from a generic word.
 *
 * §41B and the owner's §15: only a source that measured animals per unit area
 * may be called density. A count of birds detected on a survey route is
 * relative abundance, a model is a model, and a flown plot is a survey. The
 * kind comes from the reply, so the legend cannot name a measurement the map
 * did not paint.
 */
function surfaceHeading(layer: { geometryKind: string; measured: boolean }): string {
  switch (layer.geometryKind) {
    case "DENSITY_RASTER": return "Population density";
    case "MODELLED_RASTER": return layer.measured ? "Relative abundance, modelled from surveys" : "Modelled distribution";
    case "SAMPLE_PLOT": return "Survey plots";
    case "AERIAL_STRATUM": return "Aerial survey";
    case "SURVEY_GRID": return "Survey grid";
    case "OBSERVATION_POINT": return "Observations";
    case "HABITAT_LAYER": return "Habitat suitability";
    case "NORTH_GROUND_MODEL": return "North Ground habitat model";
    default: return "Species evidence";
  }
}

export default function SpeciesLayerLegend({
  speciesName,
  /** How many zones in view wear the green outline. */
  openZones,
  conditionalZones,
  hasEvidence,
  seasonsCertified = true,
  surface = null,
  everywhere = [],
}: {
  speciesName: string;
  /** Null when no season has been evaluated here, which is not zero open. */
  openZones: number | null;
  /** Of those, how many carry the condition indicator. */
  conditionalZones: number;
  /** Whether this species has certified zone-level opportunity evidence anywhere. */
  hasEvidence: boolean;
  /** Whether North Ground holds certified season rules for this species anywhere. */
  seasonsCertified?: boolean;
  /**
   * The distribution surface's own account of itself, when one is drawn.
   *
   * Every word of it comes from the surface's reply rather than from this
   * component, so a legend cannot describe a measurement the map did not paint
   * — and above all cannot call something "population density" that is a count
   * of birds detected on a survey route (§41B, and the owner's §15).
   */
  surface?: SpeciesSurfaceState | null;
  /**
   * Conditions true of EVERY open zone in their jurisdiction — said once here
   * instead of marking every zone on the map.
   *
   * §41A: a general limitation is "said once, collapsed, and never diluted"; a
   * contextual one is "shown only when that condition holds". This is the said-
   * once destination, and without it the classification only suppresses rather
   * than moves — which would lose a real requirement instead of relocating it.
   */
  everywhere?: readonly ScopedCondition[];
}) {
  /* No count is invented: "0 zones open" would be a claim about seasons that
     were never evaluated — for a species with no certified rules, or while the
     rules are still being read. */
  const seasonSummary = openZones === null
    ? (seasonsCertified ? "checking seasons" : "no certified seasons to outline")
    : `${openZones} ${openZones === 1 ? "zone" : "zones"} with a hunt open`;
  const layers = surface?.outcome === "DRAWN" ? surface.legend?.layers ?? [] : [];
  /* What the evidence half says on the collapsed chip, from the surface's
     own state — never a count of zones, because zones carry no evidence. */
  const evidenceSummary = layers.length
    ? (layers.length === 1 ? surfaceHeading(layers[0]) : `${layers.length} evidence layers`)
    : surface?.outcome === "LOADING" ? "loading evidence"
      : surface?.outcome === "NONE_IN_VIEW" ? "no evidence on this ground"
        : surface?.outcome === "UNAVAILABLE" ? "evidence unavailable"
          : "no fine-grained evidence held";
  /* Nothing shaded anywhere is a different statement from nothing shaded HERE,
     and only the first justifies dropping the ramp. `shadedZones` alone cannot
     tell them apart, so the caller passes whether any evidence exists at all. */
  const [open, setOpen] = useState(false);
  const panelId = useId();

  /* Why nothing is drawn, or null when a better-informed branch below should
     answer instead. The rule and the defect behind it are in `surface-request.ts`. */
  const explanation = notDrawnExplanation(surface);

  return (
    <div className={`${styles.legend} ng-glass-overlay`}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={panelId}
        /* Explicit, because the accessible name computed from three sibling
           spans reads as one run-on sentence — and the counts have to arrive
           in a screen reader in the same order a sighted reader gets them. */
        aria-label={
          `${speciesName} layer. ${seasonSummary}`
          + `${openZones !== null && conditionalZones ? `, ${conditionalZones} of them with conditions` : ""}; `
          + `${layers.length ? layers.map((layer) => `${surfaceHeading(layer)}. ${layer.scaleStatedAs}`).join(" ") : evidenceSummary}. `
          + "A zone without a green outline is not closed. Open the full key."
        }
        onClick={() => setOpen((was) => !was)}
      >
        <span className={styles.summaryTitle}>{speciesName} layer</span>
        <span className={styles.summaryCounts}>
          {openZones === null ? seasonSummary : `${openZones} ${openZones === 1 ? "zone" : "zones"} open`}{openZones !== null && conditionalZones ? ` · ${conditionalZones} with ${CONDITION_GLYPH}` : ""} · {evidenceSummary}
        </span>
        {/* Never behind the disclosure: this is the one sentence that prevents a false closure. */}
        <span className={styles.summaryGuard}>A zone without a green outline is not closed.</span>
        <span className={styles.chevron} aria-hidden="true" data-open={open || undefined}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>

      {open ? (
        <div className={styles.panel} id={panelId}>
          {surface && surface.legend && layers.length ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Where to look for the animal</h3>
            <div className={styles.scale}>
              <div
                className={styles.scaleBar}
                data-surface="true"
                role="img"
                aria-label="Colour scale, from the bottom tenth of where the survey found the species on the left, through blue, cyan, green, yellow and orange, to the top tenth in red."
              />
              <p className={styles.scaleEnds} aria-hidden="true"><span>Bottom tenth</span><span>Top tenth</span></p>
            </div>
            {/*
              THE THREE STATES §14 REQUIRES TO STAY APART, each with its own
              swatch and words: a colour is where the species was found, ranked;
              faint grey is ground that WAS surveyed and held none of it — for
              ruffed grouse half of everything the surface knows, and no longer
              painted blue, because none found is not a few; and ground with no
              colour at all was never surveyed.
            */}
            <p className={styles.noShade}>
              <span className={styles.swatchNone} aria-hidden="true" />
              <span>Faint grey: surveyed, and the species was not found. That is a finding.</span>
            </p>
            <p className={styles.noShade}>
              <span className={styles.swatchEmpty} aria-hidden="true" />
              <span>{surface.legend.emptyMeans}</span>
            </p>
            {layers.map((layer) => (
              <div key={layer.id} className={styles.section}>
                <h4 className={styles.sectionTitle}>{surfaceHeading(layer)}</h4>
                {/* The authority's own sentence, not a paraphrase of it. */}
                <p className={styles.detail}>{layer.scaleStatedAs} Measured in {layer.unit}.</p>
                <p className={styles.detail}>Resolution: {layer.resolutionStatedAs}</p>
                <p className={styles.detail}>
                  {layer.continuity === "CONTINUOUS"
                    ? "Dense enough to read as a field, so the colour varies inside a hunting zone and carries straight across its boundary."
                    : "Drawn only on the plots that were actually surveyed, and never interpolated between them."}
                  {" "}
                  {layer.unmappedGround === "NOT_SURVEYED"
                    ? "Ground outside a plot was not surveyed; it is not empty."
                    : "Ground with no colour is where this survey could not reach — which is a finding about the survey, not about the animals."}
                </p>
                {layer.seasonWarning ? <p className={styles.detail}>{layer.seasonWarning}</p> : null}
                <p className={styles.detail}>
                  {layer.authority}
                  {layer.url ? <> · <a href={layer.url} target="_blank" rel="noreferrer">{layer.title || "Source"}</a></> : null}
                  {layer.licence ? ` · ${layer.licence}` : ""}
                </p>
                {layer.limitations.map((line) => <p key={line} className={styles.detail}>{line}</p>)}
              </div>
            ))}
            {surface.legend.refusals.map((line) => <p key={line} className={styles.detail}>{line}</p>)}
          </section>
          ) : surface?.outcome === "LOADING" ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Where to look for the animal</h3>
              <p className={styles.detail}>Loading the evidence for {speciesName.toLowerCase()}…</p>
            </section>
          ) : explanation ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Where to look for the animal</h3>
              <p className={styles.detail}>{explanation}</p>
              {surface?.legend?.refusals.map((line) => <p key={line} className={styles.detail}>{line}</p>)}
            </section>
          ) : hasEvidence ? (
          <section className={styles.section}>
            {/* NOT_HELD, with zone-level figures. They are real and they are
                kept — in the zone card and here — but a figure for a whole zone
                says nothing about where inside it the animals are, so it is
                never painted as heat (§41B: coarse evidence never modifies the
                surface). The map stays unshaded, and says why in words. */}
            <h3 className={styles.sectionTitle}>No fine-grained evidence for {speciesName.toLowerCase()}</h3>
            {/* ONE STATEMENT, NOT TWO. A second paragraph here made the same
                two points again — that a whole-area figure cannot locate animals
                inside the area, and that unshaded ground is not empty ground.
                §41A: a line repeating what has already been said is not
                thoroughness, it is the thing a hunter stops reading. */}
            <p className={styles.noShade}>
              <span className={styles.swatchEmpty} aria-hidden="true" />
              <span>{surface?.message ?? SPECIES_LAYER_LEGEND.noHeatDetail}</span>
            </p>
          </section>
          ) : (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.noHeatTitle}</h3>
              {/* The server's own sentence where there is one: it knows whether
                  the gap is "nothing held" or "held, but not drawable". */}
              <p className={styles.detail}>{surface?.message ?? SPECIES_LAYER_LEGEND.noHeatDetail}</p>
            </section>
          )}

          {everywhere.length ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Required in every open zone of its province or state</h3>
              {/* Moved here, not removed. These are true of every open zone in
                  their jurisdiction, so marking each zone said nothing about
                  which zone to look at — and made the zones with something
                  specific look identical to the rest. */}
              {everywhere.map((condition) => (
                <p key={condition.id} className={styles.detail} data-condition-id={condition.id}>
                  <AuthorityText into={INTERFACE_LANGUAGE} text={{ text: condition.text, lang: condition.lang, owner: condition.owner }} />
                </p>
              ))}
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.seasonTitle}</h3>
            <p className={styles.seasonRow}>
              <span className={styles.seasonSwatch} aria-hidden="true" style={{ borderColor: SEASON_OPEN_STROKE }} />
              <span>A legal hunt is open here on this date</span>
            </p>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.seasonDetail}</p>
            <p className={styles.guard}>{SPECIES_LAYER_LEGEND.notGreen}</p>
          </section>

          {/* The `!` has its own row rather than a colour: there is no
              conditional tint on this layer, by owner decision. */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.conditionTitle}</h3>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.conditionDetail}</p>
          </section>

          {hasEvidence || layers.length ? <p className={styles.detail}>{SPECIES_LAYER_LEGEND.independent}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
