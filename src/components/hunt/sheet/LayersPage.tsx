"use client";

import type { CanonicalId } from "../../../lib/content-contract";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import type { OverlayLayerDescriptor } from "../../../lib/hunt/exploration/overlay-layers";
import { EXPLORATION_WORDING } from "../../../lib/hunt/exploration/states";
import { officialTermPlural, ZONE_LAYERS } from "../../../lib/hunt/zone-layers";
import styles from "../HuntApp.module.css";

/**
 * The map's layers, organised around a hunter's questions and nothing else.
 *
 * Management zones are always drawn, each authority named. "Season status"
 * colours them by one species on the chosen day, from the same engine a full
 * Hunt runs, with a word and a glyph beside every colour. Special areas appear
 * only where North Ground already reads the authority's own service. No layer is
 * offered to fill the list.
 */

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const LEGEND_STATES = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN"] as const;

export default function LayersPage({
  basemap, mapMode, onMapMode, explorable, speciesId, explore, onExplore, onExploreSpecies,
  overlayLayers, overlaysOn, onToggleOverlay, onOpenZones, zonesInView,
}: {
  basemap: "loading" | "ready" | "fallback";
  mapMode: "terrain" | "hybrid";
  onMapMode: (mode: "terrain" | "hybrid") => void;
  explorable: SpeciesSelectorOption[];
  speciesId: CanonicalId<"species"> | null;
  explore: boolean;
  onExplore: (on: boolean) => void;
  onExploreSpecies: (id: CanonicalId<"species">) => void;
  overlayLayers: OverlayLayerDescriptor[];
  overlaysOn: string[];
  onToggleOverlay: (id: string) => void;
  onOpenZones: () => void;
  zonesInView: number;
}) {
  const selected = explorable.find((option) => option.id === speciesId) ?? null;
  return (
    <div className={styles.page}>
      {basemap === "ready" ? (
        <section aria-labelledby="layers-map">
          <h3 className={styles.listTitle} id="layers-map">Map</h3>
          <div className={styles.segmented} role="group" aria-label="Basemap">
            {(["terrain", "hybrid"] as const).map((mode) => (
              <button key={mode} type="button" className={styles.segment} aria-pressed={mapMode === mode} onClick={() => onMapMode(mode)}>
                {mode === "terrain" ? "Terrain" : "Satellite"}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="layers-zones">
        <h3 className={styles.listTitle} id="layers-zones">Hunting zones · always shown</h3>
        <ul className={styles.legendList}>
          <li><span className={styles.swatch} data-coverage="VERIFIED" aria-hidden="true" /> Certified rules for at least one species</li>
          <li><span className={styles.swatch} data-coverage="IN_DEVELOPMENT" aria-hidden="true" /> Official boundary only — rules not yet certified</li>
        </ul>
        <ul className={styles.authorityList}>
          {SERVED.map((layer) => (
            <li key={layer.id}>{layer.jurisdictionName}: {officialTermPlural(layer)} from {layer.authority}</li>
          ))}
        </ul>
        <button type="button" className={styles.linkButton} onClick={onOpenZones}>
          List the {zonesInView} zones in view
        </button>
      </section>

      <section aria-labelledby="layers-explore">
        <h3 className={styles.listTitle} id="layers-explore">Season status by species</h3>
        <p className={styles.detailNote}>Colours each zone by what the certified rules say for the whole zone on your date. Not a legality map: it never says a zone is open to you.</p>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={explore} disabled={!selected} onChange={(event) => onExplore(event.target.checked)} />
          <span>{selected ? `Colour zones for ${selected.displayName}` : "Choose a species to colour zones by"}</span>
        </label>
        <ul className={styles.chipList} aria-label="Species with certified rules">
          {explorable.map((option) => (
            <li key={option.id}>
              <button type="button" className={styles.chip} aria-pressed={option.id === speciesId && explore} onClick={() => onExploreSpecies(option.id)}>
                {option.displayName}
              </button>
            </li>
          ))}
        </ul>
        {explore ? (
          <ul className={styles.legendList} aria-label="What the colours mean">
            {LEGEND_STATES.map((state) => (
              <li key={state}>
                <span className={styles.legendGlyph} data-state={state} aria-hidden="true">{EXPLORATION_WORDING[state].glyph}</span>
                <span><strong>{EXPLORATION_WORDING[state].label}.</strong> {EXPLORATION_WORDING[state].detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="layers-special">
        <h3 className={styles.listTitle} id="layers-special">Special areas</h3>
        {overlayLayers.length ? (
          <ul className={styles.toggleList}>
            {overlayLayers.map((layer) => (
              <li key={layer.id}>
                <label className={styles.switchRow}>
                  <input type="checkbox" checked={overlaysOn.includes(layer.id)} onChange={() => onToggleOverlay(layer.id)} />
                  <span>
                    <strong>{layer.name}</strong> · {layer.jurisdictionName}
                    <span className={styles.optionSecondary}>{layer.authority}. {layer.standing}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailNote}>No certified special-area layer covers this view. North Ground adds one only where the authority publishes it.</p>
        )}
      </section>
    </div>
  );
}
