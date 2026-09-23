"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StoredZone } from "../../../lib/hunt/exploration/geometry-store";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState } from "../../../lib/hunt/exploration/states";
import { ZONE_LAYERS } from "../../../lib/hunt/zone-layers";
import styles from "../HuntApp.module.css";

/**
 * The map in words: every official zone drawn in the current view, by name,
 * with its coverage or its season status. Choosing one does exactly what
 * tapping it on the map does. This list is how the map is used without a
 * pointer, and how it is read without sight.
 */

const JURISDICTION = new Map(ZONE_LAYERS.map((layer) => [layer.id, layer.jurisdictionName]));
/**
 * Whether North Ground holds certified RULES for a layer — a different fact
 * from whether its BOUNDARY is certified, and they must not be read off each
 * other.
 *
 * This list said "Certified rules" or "Boundary only" from `zone.coverage`,
 * which is the status of the GEOMETRY: whether the authority's own map is
 * parity-certified. British Columbia made the confusion visible — its units
 * now answer CLOSED quoting B.C. Reg. 190/84 while their geometry is still
 * IN_DEVELOPMENT, so the list called a zone "boundary only" beside a card
 * answering from certified rules with a source.
 *
 * Both claims were true; one was being said at the wrong scope. Neither is
 * deleted: rules come from `rulesServing`, the boundary's own standing is said
 * about the boundary, and the per-species answer on the card is unchanged —
 * it is the most specific true thing and outranks either summary.
 */
const RULES_SERVING = new Map(ZONE_LAYERS.map((layer) => [layer.id, Boolean(layer.rulesServing)]));

export default function ZonesPage({ zones, states, onChoose, autoFocus }: {
  zones: StoredZone[];
  states: ReadonlyMap<string, ZoneState> | null;
  onChoose: (key: string) => void;
  autoFocus: boolean;
}) {
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  const listed = useMemo(() => {
    const query = filter.trim().toUpperCase();
    return zones
      .filter((zone) => !query || zone.label.toUpperCase().includes(query) || zone.name.toUpperCase() === query || zone.accessibleLabel.toUpperCase().includes(query))
      // An exact designation first ("71" before "718"), then by jurisdiction and designation.
      .sort((a, b) => Number(b.name.toUpperCase() === query) - Number(a.name.toUpperCase() === query) ||
        a.layerId.localeCompare(b.layerId) || a.name.localeCompare(b.name, "en", { numeric: true }))
      .slice(0, 300);
  }, [zones, filter]);

  return (
    <div className={styles.page}>
      <div className={styles.searchField} data-compact="true">
        <label className="ng-visually-hidden" htmlFor={`${id}-filter`}>Filter zones by name or number</label>
        <input
          ref={inputRef}
          id={`${id}-filter`}
          className={styles.searchInput}
          type="search"
          inputMode="text"
          autoComplete="off"
          placeholder="Filter, e.g. 57"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <p className={styles.searchStatus} role="status">{listed.length} of {zones.length} zones in view</p>
      <ul className={styles.optionList}>
        {listed.map((zone) => {
          const state = states?.get(zone.key);
          return (
            <li key={zone.key}>
              <button type="button" className={styles.optionRow} onClick={() => onChoose(zone.key)}>
                <span className={styles.optionText}>
                  <span className={styles.optionPrimary}>{zone.label}</span>
                  <span className={styles.optionSecondary} data-state={state}>
                    {JURISDICTION.get(zone.layerId) ?? ""}
                    {state
                      ? ` · ${EXPLORATION_WORDING[state].glyph} ${EXPLORATION_WORDING[state].label}`
                      : RULES_SERVING.get(zone.layerId)
                        ? " · Certified rules"
                        : " · Official boundary, rules not yet certified"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!listed.length ? <li className={styles.inlineNotice}>No drawn zone matches.</li> : null}
      </ul>
    </div>
  );
}
