"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EXPLORATION_WORDING, type ExplorationState, type SpeciesZoneSummary, type ZoneSummary } from "../../lib/hunt/exploration/states";
import type { OverlayFeature, OverlayLayerDescriptor } from "../../lib/hunt/exploration/overlay-layers";
import { COVERAGE_WORDING } from "../../lib/hunt/zone-layers";
import styles from "./Hunt.module.css";

/**
 * The map's sheet: a zone card, a special-area card, or a pin preview.
 *
 * On a phone it is a bottom sheet that can be lowered to its header so the map
 * stays in view; on a wide screen it floats beside the zone. It never holds a
 * rule of its own — everything it states arrives from the zone-summary API,
 * which asks the same regulatory engine a full Hunt does.
 */

export type SummaryLoad =
  | { kind: "loading" }
  | { kind: "ready"; summary: ZoneSummary }
  | { kind: "error"; message: string };

export interface BoundaryNote {
  distanceMeters?: number;
  neighbourLabel?: string;
}

function readableDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));
}

function Sheet({ label, onClose, children, footer, focusOnOpen = false }: {
  label: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  /** Move focus into the sheet when it opens: only when the person opened it from the keyboard list. */
  focusOnOpen?: boolean;
}) {
  const [lowered, setLowered] = useState(false);
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focusOnOpen) sectionRef.current?.focus();
  }, [focusOnOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={`${styles.mapSheet} ng-glass-popover`}
      aria-labelledby={headingId}
      data-lowered={lowered || undefined}
    >
      <div className={styles.mapSheetBar}>
        <button
          type="button"
          className={styles.mapSheetHandle}
          aria-expanded={!lowered}
          onClick={() => setLowered((value) => !value)}
        >
          <span aria-hidden="true" />
          <span className="ng-visually-hidden">{lowered ? `Show ${label} details` : `Lower ${label} details to see the map`}</span>
        </button>
        <button type="button" className={styles.mapInspectorClose} onClick={onClose}>
          <span className="ng-visually-hidden">Close {label}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none">
            <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={styles.mapSheetBody} id={`${headingId}-body`}>
        <HeadingContext.Provider value={headingId}>{children}</HeadingContext.Provider>
      </div>
      {footer ? <div className={styles.mapSheetFooter}>{footer}</div> : null}
    </section>
  );
}

const HeadingContext = createContext<string | undefined>(undefined);
function SheetHeading({ children }: { children: ReactNode }) {
  const id = useContext(HeadingContext);
  return <h2 id={id} className={styles.mapSheetTitle}>{children}</h2>;
}

function StateChip({ state }: { state: ExplorationState }) {
  const wording = EXPLORATION_WORDING[state];
  return (
    <span className={styles.exploreChip} data-state={state}>
      <span aria-hidden="true">{wording.glyph}</span> {wording.label}
    </span>
  );
}

function SpeciesGroup({ state, species, render }: {
  state: ExplorationState;
  species: SpeciesZoneSummary[];
  render?: (entry: SpeciesZoneSummary) => ReactNode;
}) {
  if (!species.length) return null;
  return (
    <div className={styles.exploreGroup}>
      <h3 className={styles.exploreGroupTitle}>
        <StateChip state={state} /> <span className={styles.exploreCount}>{species.length}</span>
      </h3>
      {render ? (
        <ul className={styles.exploreList}>
          {species.map((entry) => <li key={entry.speciesId}>{render(entry)}</li>)}
        </ul>
      ) : (
        <p className={styles.exploreInline}>{species.map((entry) => entry.name).join(" · ")}</p>
      )}
    </div>
  );
}

/* ── Zone card ────────────────────────────────────────────────────────────── */

export function ZoneCard({
  load, zoneLabel, date, isToday, isHuntZone, boundary, parts, onClose, onCheckHunt, focusOnOpen,
}: {
  focusOnOpen?: boolean;
  load: SummaryLoad;
  zoneLabel: string;
  date: string;
  isToday: boolean;
  isHuntZone: boolean;
  boundary: BoundaryNote | null;
  parts?: number;
  onClose: () => void;
  onCheckHunt: () => void;
}) {
  const summary = load.kind === "ready" ? load.summary : null;
  const by = (state: ExplorationState) => summary?.species.filter((entry) => entry.state === state) ?? [];
  const dateLine = isToday ? `Today · ${readableDay(date)}` : `Status on ${readableDay(date)}`;
  const requirements = summary?.requirements ?? [];
  const shownRequirements = requirements.slice(0, 3);

  return (
    <Sheet
      label={`${zoneLabel} card`}
      onClose={onClose}
      focusOnOpen={focusOnOpen}
      footer={
        <button type="button" className={styles.primaryButton} onClick={onCheckHunt}>
          {isHuntZone ? `Check a hunt in ${zoneLabel}` : `Choose a spot in ${zoneLabel}`}
          <span aria-hidden="true"> →</span>
        </button>
      }
    >
      <p className={styles.mapSheetEyebrow}>
        {summary ? `${summary.zone.officialTerm} · ${summary.zone.jurisdictionName}` : "Official zone"}
        {isHuntZone ? " · Your hunt location" : ""}
      </p>
      <SheetHeading>{zoneLabel}</SheetHeading>
      {summary ? (
        <p className={styles.mapSheetMeta}>
          <span className="ng-status" data-status={summary.zone.coverage === "VERIFIED" ? "OPEN" : "UNKNOWN"}>
            {COVERAGE_WORDING[summary.zone.coverage].label}
          </span>
          <span>{dateLine}</span>
        </p>
      ) : null}

      {isHuntZone && boundary ? (
        <p className={styles.zoneWarning} role="note">
          <strong>
            {boundary.neighbourLabel
              ? `Near the boundary of ${zoneLabel} and ${boundary.neighbourLabel}.`
              : `Near the boundary of ${zoneLabel}.`}
          </strong>{" "}
          {boundary.distanceMeters !== undefined ? `About ${boundary.distanceMeters.toLocaleString("en-CA")} m from the mapped line. ` : ""}
          Verify your exact hunting position before relying on the result — map geometry and consumer GPS are not a legal survey.
        </p>
      ) : null}

      {load.kind === "loading" ? (
        <p className={styles.zoneLoading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Reading the certified rules for this zone…
        </p>
      ) : null}
      {load.kind === "error" ? <p className={styles.fieldNote} data-tone="error" role="status">{load.message}</p> : null}

      {summary && summary.counts.jurisdictionSpecies === 0 ? (
        <p className={styles.mapInspectorNote}>
          North Ground has not certified hunting rules in {summary.zone.jurisdictionName}. The boundary is official; what applies inside it is not yet covered.
        </p>
      ) : null}

      {summary && summary.counts.jurisdictionSpecies > 0 && summary.counts.certifiedHere === 0 ? (
        <p className={styles.mapInspectorNote}>
          None of the {summary.counts.jurisdictionSpecies} species North Ground covers in {summary.zone.jurisdictionName} has a certified rule
          for this zone. That is a gap in coverage, not a closed season.
        </p>
      ) : null}

      {summary && summary.counts.certifiedHere > 0 ? (
        <div className={styles.exploreGroups}>
          <SpeciesGroup
            state="SEASON_AVAILABLE"
            species={by("SEASON_AVAILABLE")}
            render={(entry) => (
              <>
                <span className={styles.exploreName}>{entry.name}</span>
                {entry.season ? <span className={styles.exploreMeta}>until {readableDay(entry.season.closes)}</span> : null}
              </>
            )}
          />
          <SpeciesGroup
            state="SEASON_EXCEPT_AREAS"
            species={by("SEASON_EXCEPT_AREAS")}
            render={(entry) => (
              <>
                <span className={styles.exploreName}>{entry.name}</span>
                <span className={styles.exploreMeta}>
                  {entry.season ? `Until ${readableDay(entry.season.closes)}, e` : "E"}xcept
                  {entry.exceptInside?.length === 1
                    ? ` inside ${entry.exceptInside[0]}`
                    : ` in the ${entry.exceptInside?.length ?? 0} restricted areas listed below`}
                </span>
              </>
            )}
          />
          <SpeciesGroup
            state="CHECK_REQUIREMENTS"
            species={by("CHECK_REQUIREMENTS")}
            render={(entry) => (
              <>
                <span className={styles.exploreName}>{entry.name}</span>
                {entry.question ? <span className={styles.exploreMeta}>Asks: {entry.question}</span> : null}
              </>
            )}
          />
          <SpeciesGroup
            state="NEEDS_VERIFICATION"
            species={by("NEEDS_VERIFICATION")}
            render={(entry) => (
              <>
                <span className={styles.exploreName}>{entry.name}</span>
                {entry.detail ? <span className={styles.exploreMeta}>{entry.detail}</span> : null}
              </>
            )}
          />
          <SpeciesGroup state="CONFLICT" species={by("CONFLICT")} />
          <SpeciesGroup state="CLOSED" species={by("CLOSED")} />
          <SpeciesGroup state="UNKNOWN" species={by("UNKNOWN")} />
          {by("SEASON_AVAILABLE").length || by("SEASON_EXCEPT_AREAS").length ? (
            <p className={styles.mapInspectorNote}>
              “In season” means a season is open for every licence the rules recognise. It is not a licence check,
              and legal hours and local restrictions still apply.
            </p>
          ) : null}
        </div>
      ) : null}

      {summary?.specialAreas?.length ? (
        <div className={styles.exploreGroup}>
          <h3 className={styles.exploreGroupTitle}>Restricted areas inside {zoneLabel}</h3>
          <ul className={styles.exploreNotes}>
            {summary.specialAreas.slice(0, 4).map((area) => (
              <li key={`${area.name}|${area.statedAs}`}>
                <strong>{area.name}</strong> — “{area.statedAs}” <span className={styles.exploreMeta}>Affects {area.species.join(", ").toLowerCase()}.</span>
              </li>
            ))}
            {summary.specialAreas.length > 4 ? (
              <li>{summary.specialAreas.length - 4} more; switch them on under Layers to see where they are.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {summary && (shownRequirements.length || summary.pointOnlyChecks) ? (
        <div className={styles.exploreGroup}>
          <h3 className={styles.exploreGroupTitle}>Special considerations</h3>
          <ul className={styles.exploreNotes}>
            {shownRequirements.map((line) => <li key={line}>{line}</li>)}
            {requirements.length > shownRequirements.length ? (
              <li>{requirements.length - shownRequirements.length} more in a full check.</li>
            ) : null}
            {summary.pointOnlyChecks ? (
              <li>
                {summary.pointOnlyChecks.charAt(0).toUpperCase() + summary.pointOnlyChecks.slice(1)} inside this zone are
                checked only for an exact point.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {summary ? (
        <dl className={styles.exploreFacts}>
          <div>
            <dt>Certified here</dt>
            <dd>
              {summary.counts.certifiedHere} of {summary.counts.jurisdictionSpecies} species
            </dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>{summary.zone.authority}</dd>
          </div>
          {parts && parts > 1 ? (
            <div>
              <dt>Published as</dt>
              <dd>{parts.toLocaleString("en-CA")} parts</dd>
            </div>
          ) : null}
          {summary.verifiedAt ? (
            <div>
              <dt>Rules last verified</dt>
              <dd>{readableDay(summary.verifiedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Sheet>
  );
}

/* ── Special-area card ────────────────────────────────────────────────────── */

export function OverlayCard({ feature, layer, onClose }: {
  feature: OverlayFeature;
  layer: OverlayLayerDescriptor | null;
  onClose: () => void;
}) {
  return (
    <Sheet label={`${feature.name} card`} onClose={onClose}>
      <p className={styles.mapSheetEyebrow}>
        {feature.type ?? layer?.name ?? "Special area"}{layer ? ` · ${layer.jurisdictionName}` : ""}
      </p>
      <SheetHeading>{feature.name}</SheetHeading>
      {feature.statedAs ? (
        <blockquote className={styles.exploreQuote}>
          “{feature.statedAs}”
          {feature.regulation ? <cite>{feature.regulation}</cite> : null}
        </blockquote>
      ) : (
        <p className={styles.mapInspectorNote}>The authority publishes no restriction text for this area in its layer.</p>
      )}
      {layer ? (
        <dl className={styles.exploreFacts}>
          <div><dt>Authority</dt><dd>{layer.authority}</dd></div>
          <div><dt>Standing</dt><dd>{layer.standing}</dd></div>
          <div><dt>Drawn from</dt><dd>The authority&apos;s live service, read for this view</dd></div>
        </dl>
      ) : null}
    </Sheet>
  );
}

/* ── Pin preview ──────────────────────────────────────────────────────────── */

export type PinZone =
  | { kind: "loading" }
  | { kind: "resolved"; label: string; jurisdiction: string }
  | { kind: "none"; message: string };

export function PinPreviewCard({ mode, zone, point, onConfirm, onCancel }: {
  mode: "pressed" | "centre";
  zone: PinZone;
  point: { latitude: number; longitude: number };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      label="Location preview"
      onClose={onCancel}
      footer={
        <div className={styles.mapSheetActions}>
          <button type="button" className={styles.primaryButton} onClick={onConfirm}>
            Check this location
          </button>
          <button type="button" className={`${styles.locateButton} ng-glass-control`} onClick={onCancel}>
            Cancel
          </button>
        </div>
      }
    >
      <p className={styles.mapSheetEyebrow}>Preview · not selected yet</p>
      <SheetHeading>Hunt here?</SheetHeading>
      <p className={styles.mapInspectorNote}>
        {mode === "centre"
          ? "Move the map to put the crosshair on your hunting spot. Arrow keys move the map too."
          : "This point is only a preview. Confirm it to make it your hunt location."}
      </p>
      <p className={styles.mapSheetMeta} aria-live="polite">
        {zone.kind === "loading" ? "Finding the official zone…"
          : zone.kind === "resolved" ? `${zone.label} · ${zone.jurisdiction}`
          : zone.message}
      </p>
      <details className={styles.locationDetails}>
        <summary>Coordinates</summary>
        <p className="ng-numeric">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>
      </details>
    </Sheet>
  );
}
