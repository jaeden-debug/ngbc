"use client";

import { useEffect, useId, useState } from "react";
import { SEASON_OPEN_STROKE } from "../../lib/hunt/exploration/cartography";
import { CONDITION_GLYPH, HEAT_WORDING, SPECIES_LAYER_LEGEND } from "../../lib/hunt/exploration/species-layer";
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

/* Cold to hot, the order the bar reads in. The bar is painted from
   `--ng-heat-gradient`, which mirrors `HEAT_RAMP`; these words sit under it. */
const BANDS: Array<Exclude<OpportunityClass, "LIMITED_DATA">> = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"];

export interface SurfaceLegend {
  metricLabel: string;
  metricMeaning: string;
  unit: string;
  emptyMeans: string;
  zeroMeans: string;
  resolutionStatedAs: string;
  continuity: "CONTINUOUS" | "DISCRETE";
  provenance: Record<string, unknown> | null;
  surveyed: number;
  detected: number;
}

interface Measure { metric: string; role: string; meaning: string; contributes: boolean; weight?: number }
interface MethodologyDataset {
  jurisdictionId: string;
  authority: string;
  title: string;
  url: string;
  licence: string;
  attribution?: string;
  observationYear: number;
  spatialPrecision: string;
  renderKindMeaning: string;
  grade: string;
  zoneCount: number;
  independentValues: number;
  measures: Measure[];
  limitations: string[];
}
interface MethodologyReply {
  status?: string;
  methodology?: { version: string; statedAs: string; normalization: string; missingData: string; effort: string; confidence: string; limitations: string[] };
  datasets?: MethodologyDataset[];
}

/**
 * The methodology, fetched only when a hunter asks for it.
 *
 * It is the same read model the map is painted from, so the panel cannot
 * describe a calculation the map did not perform — and it is not folded into
 * the heat reply, which is sent on every pan.
 */
function useHeatMethodology(speciesId: string | null, wanted: boolean): MethodologyReply | null {
  const [reply, setReply] = useState<MethodologyReply | null>(null);
  useEffect(() => {
    if (!wanted || !speciesId) return;
    const controller = new AbortController();
    fetch(`/api/hunt/opportunity/methodology?speciesId=${encodeURIComponent(speciesId)}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<MethodologyReply>)
      .then(setReply)
      /* A panel that cannot load says nothing rather than guessing at what the
         map did; the ramp's own caveats are already on the key above it. */
      .catch(() => { /* no methodology is shown */ });
    return () => controller.abort();
  }, [speciesId, wanted]);
  return reply;
}

export default function SpeciesLayerLegend({
  speciesName,
  speciesId,
  /** How many zones in view hold heat evidence, and how many wear the green outline. */
  shadedZones,
  openZones,
  conditionalZones,
  hasEvidence,
  surface = null,
}: {
  speciesName: string;
  /** Used only to ask for the methodology, and only once a hunter opens it. */
  speciesId: string;
  shadedZones: number;
  openZones: number;
  /** Of those, how many carry the condition indicator. */
  conditionalZones: number;
  /** Whether this species has certified opportunity evidence ANYWHERE. */
  hasEvidence: boolean;
  /**
   * The distribution surface's own account of itself, when one is drawn.
   *
   * Every word of it comes from the surface's reply rather than from this
   * component, so a legend cannot describe a measurement the map did not paint
   * — and above all cannot call something "population density" that is a count
   * of birds detected on a survey route (§41B, and the owner's §15).
   */
  surface?: SurfaceLegend | null;
}) {
  /* Nothing shaded anywhere is a different statement from nothing shaded HERE,
     and only the first justifies dropping the ramp. `shadedZones` alone cannot
     tell them apart, so the caller passes whether any evidence exists at all. */
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(false);
  const panelId = useId();
  const methodId = useId();
  const methodology = useHeatMethodology(speciesId, method);

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
          `${speciesName} layer. ${openZones} ${openZones === 1 ? "zone" : "zones"} with a hunt open`
          + `${conditionalZones ? `, ${conditionalZones} of them with conditions` : ""}; `
          + `${surface ? `${surface.metricLabel} shown across ${surface.surveyed} surveyed cells in view` : hasEvidence ? `${shadedZones} with heat evidence` : "no heat evidence held for this species"}. `
          + "A zone without a green outline is not closed. Open the full key."
        }
        onClick={() => setOpen((was) => !was)}
      >
        <span className={styles.summaryTitle}>{speciesName} layer</span>
        <span className={styles.summaryCounts}>
          {openZones} {openZones === 1 ? "zone" : "zones"} open{conditionalZones ? ` · ${conditionalZones} with ${CONDITION_GLYPH}` : ""} · {surface ? surface.metricLabel : hasEvidence ? `${shadedZones} with evidence` : "no heat evidence held"}
        </span>
        {/* Never behind the disclosure: this is the one sentence that prevents a false closure. */}
        <span className={styles.summaryGuard}>A zone without a green outline is not closed.</span>
        <span className={styles.chevron} aria-hidden="true" data-open={open || undefined}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>

      {open ? (
        <div className={styles.panel} id={panelId}>
          {surface ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{surface.metricLabel} — where to look for the animal</h3>
            <div className={styles.scale}>
              <div
                className={styles.scaleBar}
                data-surface="true"
                role="img"
                aria-label="Colour scale, from low on the left through blue, cyan, green, yellow and orange to red at the highest."
              />
              <p className={styles.scaleEnds} aria-hidden="true"><span>Lower</span><span>Higher</span></p>
            </div>
            {/*
              THE THREE STATES §14 REQUIRES TO STAY APART, in words, because two
              of them are hard to tell apart by eye: a faint blue that was
              surveyed, and ground with no colour at all that was not.
            */}
            <p className={styles.noShade}>
              <span className={styles.swatchEmpty} aria-hidden="true" />
              <span>{surface.emptyMeans}</span>
            </p>
            <p className={styles.detail}>{surface.zeroMeans}</p>
            <p className={styles.detail}>{surface.metricMeaning} Measured in {surface.unit}.</p>
            <p className={styles.detail}>
              Resolution {surface.resolutionStatedAs}. {surface.continuity === "CONTINUOUS"
                ? "The survey is dense enough to read as a continuous field, so the colour varies within a hunting zone and carries straight across its boundary."
                : "Drawn only where the survey was actually carried out, and never interpolated between those places."}
            </p>
            {surface.provenance ? (
              <p className={styles.detail}>
                {String(surface.provenance.authority ?? "")}
                {surface.provenance.url ? <> · <a href={String(surface.provenance.url)} target="_blank" rel="noreferrer">{String(surface.provenance.title ?? "Source")}</a></> : null}
                {surface.provenance.licence ? ` · ${String(surface.provenance.licence)}` : ""}
              </p>
            ) : null}
            {Array.isArray(surface.provenance?.limitations)
              ? (surface.provenance.limitations as string[]).map((line) => <p key={line} className={styles.detail}>{line}</p>)
              : null}
          </section>
          ) : hasEvidence ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.heatTitle}</h3>
            {/* A continuous bar, because the map paints a continuous value.
                The bar carries no meaning on its own: the ends and the band
                words below it say it in text (§48). */}
            <div className={styles.scale}>
              <div className={styles.scaleBar} role="img" aria-label="Heat scale, from lower evidence on the left to higher on the right." />
              <p className={styles.scaleEnds} aria-hidden="true"><span>Lower</span><span>Higher</span></p>
              <ul className={styles.bands}>
                {BANDS.map((band) => (
                  <li key={band} className={styles.band}>
                    <span className={styles.bandGlyph} aria-hidden="true">{HEAT_WORDING[band].glyph}</span>
                    <span>{HEAT_WORDING[band].label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.noShade}>
              <span className={styles.swatchEmpty} aria-hidden="true" />
              <span>{HEAT_WORDING.LIMITED_DATA.label} — or none held here. Not a zone with no animals.</span>
            </p>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.heatDetail}</p>
            {/* The correction this version exists for, on the face of the key.
                A hunter who believes the shade follows hunters misreads every
                crowded unit on the map. */}
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.heatEffort}</p>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.heatResolution}</p>
            <p className={styles.detail}>{SPECIES_LAYER_LEGEND.heatStrength}</p>

            <button
              type="button"
              className={styles.method}
              aria-expanded={method}
              aria-controls={methodId}
              onClick={() => setMethod((was) => !was)}
            >
              {SPECIES_LAYER_LEGEND.howCalculated}
            </button>
            {method ? (
              <div className={styles.methodPanel} id={methodId}>
                {methodology?.datasets?.length ? (
                  <>
                    {methodology.datasets.map((dataset) => (
                      <article key={dataset.jurisdictionId} className={styles.dataset}>
                        <h4 className={styles.datasetTitle}>{dataset.authority}</h4>
                        <p className={styles.detail}>
                          {dataset.title} — {dataset.observationYear}, {dataset.zoneCount} areas at {dataset.spatialPrecision}.
                        </p>
                        <ul className={styles.measures}>
                          {dataset.measures.map((measure) => (
                            <li key={measure.metric} className={styles.measure}>
                              <span>{measure.metric.toLowerCase().replaceAll("_", " ")}</span>
                              {/* The weight, or the reason there is none. Effort
                                  appears here saying so, rather than being left
                                  out — a measurement silently dropped looks the
                                  same as one that was never published. */}
                              <span className={styles.measureWeight}>
                                {measure.contributes ? `${Math.round((measure.weight ?? 0) * 100)}% of the shade` : "not counted"}
                              </span>
                              <span className={styles.measureMeaning}>{measure.meaning}</span>
                            </li>
                          ))}
                        </ul>
                        <p className={styles.detail}>{dataset.renderKindMeaning}</p>
                        {dataset.limitations.map((limitation) => (
                          <p key={limitation} className={styles.detail}>{limitation}</p>
                        ))}
                        <p className={styles.detail}>
                          <a href={dataset.url} target="_blank" rel="noreferrer">{dataset.licence}</a>
                          {dataset.attribution ? ` — ${dataset.attribution}` : ""}
                        </p>
                      </article>
                    ))}
                    {methodology.methodology ? (
                      <>
                        <p className={styles.detail}>{methodology.methodology.statedAs}</p>
                        <p className={styles.detail}>{methodology.methodology.normalization}</p>
                        <p className={styles.detail}>{methodology.methodology.missingData}</p>
                        <p className={styles.detail}>Methodology {methodology.methodology.version}.</p>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className={styles.detail}>{SPECIES_LAYER_LEGEND.howCalculatedDetail}</p>
                )}
              </div>
            ) : null}
          </section>
          ) : (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{SPECIES_LAYER_LEGEND.noHeatTitle}</h3>
              <p className={styles.detail}>{SPECIES_LAYER_LEGEND.noHeatDetail}</p>
            </section>
          )}

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

          {hasEvidence ? <p className={styles.detail}>{SPECIES_LAYER_LEGEND.independent}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
