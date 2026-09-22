"use client";

import type { CanonicalId } from "../../../lib/content-contract";
import type { Emphasis } from "../../../lib/hunt/exploration/cartography";
import type { SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import type { OverlayLayerDescriptor } from "../../../lib/hunt/exploration/overlay-layers";
import styles from "../HuntApp.module.css";

/**
 * What the map looks like, and what is on it.
 *
 * Each row is a label and a control. Nothing here explains itself at length:
 * where something needs explaining it belongs on the thing it affects — the
 * authority on the special area it draws, the meaning of a state on the state
 * itself — not in a sheet of prose nobody reads on a hillside.
 */

const EMPHASIS_LABEL: Record<Emphasis, string> = { light: "Light", standard: "Standard", strong: "Strong" };
const BASEMAPS = [
  { id: "roadmap", label: "Standard" },
  { id: "hybrid", label: "Satellite" },
  { id: "terrain", label: "Terrain" },
] as const;

export type BasemapMode = (typeof BASEMAPS)[number]["id"];

export default function LayersPage({
  basemap, mapMode, onMapMode, zonesVisible, onZonesVisible, emphasis, onEmphasis,
  explorable, speciesId, explore, onExplore,
  overlayLayers, overlaysOn, onToggleOverlay, onOpenZones, zonesInView,
}: {
  basemap: "loading" | "ready" | "fallback";
  mapMode: BasemapMode;
  onMapMode: (mode: BasemapMode) => void;
  zonesVisible: boolean;
  onZonesVisible: (visible: boolean) => void;
  emphasis: Emphasis;
  onEmphasis: (emphasis: Emphasis) => void;
  explorable: SpeciesSelectorOption[];
  speciesId: CanonicalId<"species"> | null;
  explore: boolean;
  onExplore: (on: boolean) => void;
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
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>Map</span>
          <div className={styles.segmented} role="group" aria-label="Basemap">
            {BASEMAPS.map((mode) => (
              <button key={mode.id} type="button" className={styles.segment} aria-pressed={mapMode === mode.id} onClick={() => onMapMode(mode.id)}>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className={styles.controlRow}>
        <span className={styles.controlLabel}>Zone boundaries</span>
        <input type="checkbox" className={styles.switchInput} checked={zonesVisible} onChange={(event) => onZonesVisible(event.target.checked)} />
      </label>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Boundary visibility</span>
        <div className={styles.segmented} role="group" aria-label="Boundary visibility">
          {(["light", "standard", "strong"] as const).map((level) => (
            <button key={level} type="button" className={styles.segment} aria-pressed={emphasis === level} onClick={() => onEmphasis(level)}>
              {EMPHASIS_LABEL[level]}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.controlRow}>
        <span className={styles.controlLabel}>
          Colour zones by season
          <span className={styles.controlNote}>{selected ? `For ${selected.displayName.toLowerCase()}, on your date` : "Choose a species first"}</span>
        </span>
        <input
          type="checkbox"
          className={styles.switchInput}
          checked={explore}
          disabled={!selected}
          onChange={(event) => onExplore(event.target.checked)}
        />
      </label>

      {overlayLayers.length ? (
        overlayLayers.map((layer) => (
          <label key={layer.id} className={styles.controlRow}>
            <span className={styles.controlLabel}>
              {layer.name}
              {/* The authority belongs to the area it draws; the card names it in full. */}
              <span className={styles.controlNote}>{layer.jurisdictionName} · {layer.authority}</span>
            </span>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={overlaysOn.includes(layer.id)}
              onChange={() => onToggleOverlay(layer.id)}
            />
          </label>
        ))
      ) : (
        <p className={styles.controlEmpty}>Special regulatory areas: none published for this view.</p>
      )}

      <button type="button" className={styles.linkButton} onClick={onOpenZones}>
        List the {zonesInView} zones in view
      </button>
    </div>
  );
}
