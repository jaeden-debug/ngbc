"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { todayIso } from "../../lib/hunt/date";
import { COVERAGE_SUMMARY, COVERED_JURISDICTIONS, hasSpeciesCoverageIn, isWithinSupportedBounds, type SpeciesSelectorOption } from "../../lib/hunt/coverage";
import type { CanonicalId } from "../../lib/content-contract";
import { explorationReducer, INITIAL_EXPLORATION, roundedPoint, type HuntLocation } from "../../lib/hunt/exploration/map-state";
import { COVERAGE_WORDING } from "../../lib/hunt/zone-layers";
import type { HuntEvaluation } from "../../lib/hunt/types";
import DateField from "./DateField";
import HuntMap, { type ResolvedZone } from "./HuntMap";
import HuntQuestion from "./HuntQuestion";
import HuntResult from "./HuntResult";
import LocationSearch, { type SelectedLocation } from "./LocationSearch";
import SpeciesSelect from "./SpeciesSelect";
import styles from "./Hunt.module.css";

type LocateState = { kind: "idle" } | { kind: "locating" } | { kind: "error"; message: string };

type ZoneState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "resolved"; zone: ResolvedZone; jurisdiction: string; jurisdictionId: CanonicalId<"jurisdiction"> }
  | { kind: "unresolved"; message: string };

type EvaluationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; result: HuntEvaluation }
  | { kind: "error"; message: string };

const GEOLOCATION_MESSAGES: Record<number, string> = {
  1: "Location permission was declined. Search for a place instead — the result is identical.",
  2: "Your device could not determine a location. Search for a place instead.",
  3: "Finding your location took too long. Try again, or search for a place.",
};

/**
 * The Hunt composer.
 *
 * The page assembles an answer as information arrives rather than gating everything
 * behind one submit. A place alone resolves the official zone — a real question with
 * a real answer — and only the regulatory evaluation waits for a date and a species,
 * because only those three together can say what applies.
 */
export default function HuntComposer({ googleMapsApiKey, speciesOptions, initialDate, initialSpeciesId = null }: { googleMapsApiKey?: string; speciesOptions: SpeciesSelectorOption[]; initialDate: string; initialSpeciesId?: CanonicalId<"species"> | null }) {
  /**
   * The map's interaction state, including the one hunt location. The device's
   * own position lives in `exploration.self` and is never read below: only
   * `exploration.hunt` resolves a zone, is evaluated, or reaches a Hunt Brief.
   */
  const [exploration, dispatch] = useReducer(explorationReducer, INITIAL_EXPLORATION);
  const location: HuntLocation | null = exploration.hunt;
  const [neighbourLabel, setNeighbourLabel] = useState<string | null>(null);
  /**
   * Starts on the jurisdiction's day, which the server computed, so the first
   * client render matches the HTML it is hydrating. The viewer's own day is
   * applied immediately after mount, below.
   */
  const [date, setDate] = useState<string>(initialDate);
  const [speciesId, setSpeciesId] = useState<CanonicalId<"species"> | null>(initialSpeciesId);
  const [locateState, setLocateState] = useState<LocateState>({ kind: "idle" });
  const [zoneState, setZoneState] = useState<ZoneState>({ kind: "idle" });
  const [evaluation, setEvaluation] = useState<EvaluationState>({ kind: "idle" });
  /**
   * Self-reported facts for the current hunt only.
   *
   * Cleared whenever the species, place or date changes, because an answer is
   * about one hunt: "resident, shotgun" for deer in WMU 71 must not silently
   * carry into a moose hunt two units away, where the tag is what decides.
   */
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const resultRef = useRef<HTMLDivElement>(null);
  const speciesRef = useRef<HTMLDivElement>(null);
  const zoneRequestRef = useRef(0);

  const outsideCoverage = Boolean(location) && !isWithinSupportedBounds(location!.latitude, location!.longitude);
  const resolvedZone = zoneState.kind === "resolved" ? zoneState.zone : null;
  const selectedSpecies = speciesOptions.find(({ id }) => id === speciesId) ?? null;
  const activeJurisdictionId = zoneState.kind === "resolved" ? zoneState.jurisdictionId : undefined;
  const selectedSpeciesAvailable = selectedSpecies
    ? hasSpeciesCoverageIn(selectedSpecies, activeJurisdictionId)
    : false;

  /* "Today" on the zone card is the viewer's own day, like the date field. */
  const [isToday, setIsToday] = useState(false);
  useEffect(() => { setIsToday(date === todayIso()); }, [date]);

  /* ── The viewer's own calendar day ─────────────────────────────────────── */

  /**
   * Correct the date to the viewer's clock once, after mount.
   *
   * The server rendered the jurisdiction's day because it cannot know the
   * viewer's time zone, and for four hours each evening Ontario is a day behind
   * UTC. Reading the real clock here is the one moment the browser knows
   * something the server could not. It runs only on mount, so it can never
   * overwrite a date the person has since chosen.
   */
  useEffect(() => {
    const viewerToday = todayIso();
    if (viewerToday !== initialDate) setDate(viewerToday);
    // Mount only: `initialDate` is fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Location → zone, before any species or date ───────────────────────── */

  useEffect(() => {
    /* A different hunt point is a different hunt: the previous answer and the
       facts given for it no longer apply. */
    setEvaluation({ kind: "idle" });
    setAnswers({});
    if (!location) {
      setZoneState({ kind: "idle" });
      return;
    }
    const id = ++zoneRequestRef.current;
    setZoneState({ kind: "loading" });

    void (async () => {
      try {
        const response = await fetch("/api/hunt/zone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
        });
        const payload = await response.json() as {
          status: string; message?: string;
          zone?: ResolvedZone; layer?: { jurisdictionName: string; jurisdictionId: CanonicalId<"jurisdiction"> };
        };
        if (id !== zoneRequestRef.current) return;

        if (payload.status === "RESOLVED" && payload.zone && payload.layer?.jurisdictionId) {
          setZoneState({
            kind: "resolved",
            zone: payload.zone,
            jurisdiction: payload.layer?.jurisdictionName ?? "",
            jurisdictionId: payload.layer.jurisdictionId,
          });
          /* The resolved zone is highlighted and its card opened, so the person
             sees where the point is, which zone applies and what it means. */
          if (payload.zone.layerId && payload.zone.designation) {
            dispatch({ type: "HUNT_ZONE_RESOLVED", zone: { layerId: payload.zone.layerId, designation: payload.zone.designation } });
          }
          return;
        }
        setZoneState({
          kind: "unresolved",
          message: payload.message ?? "No official hunting zone could be resolved for this point.",
        });
      } catch {
        if (id !== zoneRequestRef.current) return;
        setZoneState({
          kind: "unresolved",
          message: "The official zone service could not be reached. North Ground will not infer a zone.",
        });
      }
    })();
    // Keyed on the point, so a better label for the same point does not re-resolve it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  /** A deliberate choice of hunt location: a search result or the explicit device action. */
  const selectLocation = useCallback((next: SelectedLocation) => {
    dispatch({ type: "HUNT_SET", location: { label: next.label, latitude: next.latitude, longitude: next.longitude, origin: next.origin } });
    setLocateState({ kind: "idle" });
  }, []);

  /** A place name for a point, where the geocoder has one. Never blocks the point itself. */
  const describePoint = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const response = await fetch("/api/hunt/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "describe", latitude, longitude }),
      });
      const payload = await response.json() as { status?: string; place?: { label: string } };
      return payload.status === "OK" && payload.place?.label ? payload.place.label : null;
    } catch {
      return null;
    }
  }, []);

  /* A previewed map point becomes the hunt location only here, on confirmation. */
  const confirmPin = useCallback(() => {
    const pin = exploration.pin;
    if (!pin) return;
    const point = roundedPoint(pin.point);
    dispatch({ type: "PIN_CONFIRMED", label: "Point chosen on the map" });
    void describePoint(point.latitude, point.longitude).then((label) => {
      if (label) dispatch({ type: "HUNT_LABELLED", point, label: `Near ${label}` });
    });
  }, [exploration.pin, describePoint]);

  /* The zone card's "Check a hunt" for the hunt zone: continue with a species. */
  const continueHunt = useCallback(() => {
    const container = speciesRef.current;
    container?.scrollIntoView({ behavior: "smooth", block: "center" });
    container?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocateState({ kind: "error", message: "This browser does not provide location access. Search for a place instead." });
      return;
    }
    if (!window.isSecureContext) {
      setLocateState({ kind: "error", message: "Location access needs a secure connection. Search for a place instead." });
      return;
    }

    setLocateState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        const label = await describePoint(latitude, longitude) ?? "Your current location";
        selectLocation({ label, latitude, longitude, origin: "device" });
      },
      (error) => {
        setLocateState({
          kind: "error",
          message: GEOLOCATION_MESSAGES[error.code] ?? "Your location was unavailable. Search for a place instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [selectLocation, describePoint]);

  const checkHunt = useCallback(async (withAnswers?: Record<string, string>) => {
    if (!location || !speciesId || outsideCoverage) return;
    const sending = withAnswers ?? answers;
    setEvaluation({ kind: "loading" });
    try {
      const response = await fetch("/api/hunt/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude, longitude: location.longitude, date, speciesId,
          answers: Object.keys(sending).length ? sending : undefined,
        }),
      });
      const payload = await response.json() as HuntEvaluation | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "This hunt could not be checked.");
      }
      setEvaluation({ kind: "ready", result: payload });
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (cause) {
      setEvaluation({
        kind: "error",
        message: cause instanceof Error ? cause.message : "This hunt could not be checked.",
      });
    }
  }, [location, speciesId, outsideCoverage, date, answers]);

  /* Answering re-evaluates at once. The engine decides whether that produced a
     result or simply the next question. */
  const answerQuestion = useCallback((dimensionId: string, value: string) => {
    const next = { ...answers, [dimensionId]: value };
    setAnswers(next);
    void checkHunt(next);
  }, [answers, checkHunt]);

  /* A new species, place or date is a different hunt. Dropping the answers here
     is what stops a deer hunter's residency from quietly deciding a moose
     result, and clearing the evaluation stops a stale answer being read as the
     answer to the new question. */
  const resetHunt = useCallback(() => {
    setAnswers({});
    setEvaluation({ kind: "idle" });
  }, []);

  /* The answers so far, rendered in the words the question used rather than as
     internal codes, and only where the dimension still offers the value. */
  const answeredSoFar = useMemo(() => {
    const dimensions = evaluation.kind === "ready" ? evaluation.result.dimensions : [];
    return dimensions.flatMap((dimension) => {
      const value = answers[dimension.id];
      const option = dimension.options.find((candidate) => candidate.value === value);
      return option ? [{ question: dimension.question, answer: option.label }] : [];
    });
  }, [answers, evaluation]);

  const busy = evaluation.kind === "loading";
  const displayedResult = evaluation.kind === "ready" ? evaluation.result : null;

  return (
    <>
      <section className={styles.stage} aria-label="Hunt map and composer">
        <div className={styles.composerLayer}>
          <div className={`${styles.composer} ng-glass-panel`}>
            <div className={styles.composerHead}>
              <p className="ng-eyebrow">North Ground Hunt</p>
              <h1 className={styles.composerTitle}>Your zone. Your season. Your hunt.</h1>
              <p className={styles.composerLede}>
                Search a place to find its official hunting zone, then add a date and a
                species for the rules that apply — with the source behind every answer.
              </p>
            </div>

            <LocationSearch
              onSelect={selectLocation}
              selectedLabel={location?.label ?? null}
              disabled={busy}
            />

            <button
              type="button"
              className={`${styles.locateButton} ng-glass-control`}
              onClick={useMyLocation}
              disabled={busy || locateState.kind === "locating"}
            >
              {locateState.kind === "locating" ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
                  <path d="M14.5 1.5 9 14.5l-1.7-5.8L1.5 7 14.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              )}
              {locateState.kind === "locating" ? "Finding you…" : "Hunt at my location"}
            </button>

            {locateState.kind === "error" ? (
              <p className={styles.fieldNote} data-tone="error" role="status">{locateState.message}</p>
            ) : null}

            {/* State B: the zone answer, available before date or species. */}
            {location ? (
              <div className={`${styles.zoneCard} ng-glass-card`} aria-live="polite">
                {zoneState.kind === "loading" ? (
                  <p className={styles.zoneLoading}>
                    <span className={styles.spinner} aria-hidden="true" />
                    Resolving the official zone…
                  </p>
                ) : zoneState.kind === "resolved" ? (
                  <>
                    <p className={styles.zoneLabel}>
                      <span className={styles.zoneName}>{zoneState.zone.shortLabel}</span>
                      <span className="ng-status" data-status={zoneState.zone.coverage === "VERIFIED" ? "OPEN" : "UNKNOWN"}>
                        {COVERAGE_WORDING[zoneState.zone.coverage].label}
                      </span>
                    </p>
                    <p className={styles.zoneMeta}>
                      {zoneState.zone.officialName}
                      {zoneState.jurisdiction ? ` · ${zoneState.jurisdiction}` : ""}
                    </p>
                    {zoneState.zone.nearBoundary ? (
                      <p className={styles.zoneWarning} role="note">
                        <strong>
                          {neighbourLabel
                            ? `Near the boundary of ${zoneState.zone.shortLabel} and ${neighbourLabel}.`
                            : "Close to a zone boundary."}
                        </strong>{" "}
                        {zoneState.zone.boundaryDistanceMeters !== undefined
                          ? `About ${zoneState.zone.boundaryDistanceMeters.toLocaleString("en-CA")} m from the mapped line. `
                          : ""}
                        Rules can differ on the other side. Verify your exact hunting position — consumer GPS is not a legal position fix.
                      </p>
                    ) : null}
                  </>
                ) : zoneState.kind === "unresolved" ? (
                  <p className={styles.zoneMeta} data-tone="warn">{zoneState.message}</p>
                ) : null}

                <details className={styles.locationDetails}>
                  <summary>Location details</summary>
                  <dl className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <dt>Selected</dt>
                      <dd>{location.label}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Coordinates</dt>
                      <dd className="ng-numeric">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Source</dt>
                      <dd>{location.origin === "device" ? "Device location, chosen by you" : location.origin === "map" ? "Point chosen on the map" : "Place search"}</dd>
                    </div>
                  </dl>
                </details>
              </div>
            ) : null}

            <DateField value={date} onChange={(next) => { setDate(next); resetHunt(); }} disabled={busy} />

            <div ref={speciesRef}>
              <SpeciesSelect
                value={speciesId}
                onChange={(next) => { setSpeciesId(next); resetHunt(); }}
                options={speciesOptions}
                jurisdictionId={activeJurisdictionId}
                disabled={busy}
              />
            </div>

            {outsideCoverage ? (
              <p className={styles.coverageWarning} role="status">
                <strong>That location is outside current coverage.</strong>
                North Ground can check hunts in {COVERED_JURISDICTIONS} today. This is a gap in our
                coverage, not a statement about hunting there.
              </p>
            ) : null}

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void checkHunt()}
              disabled={!location || !speciesId || !selectedSpeciesAvailable || outsideCoverage || busy}
            >
              {busy ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Checking official sources…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  Check this hunt
                </>
              )}
            </button>

            <p className={styles.nextStep} role="status">
              {!location
                ? "Start with a place — the map already shows the zones we can answer for."
                : !speciesId
                ? "Choose a species to check seasons, limits and conditions for this zone."
                : !selectedSpeciesAvailable
                ? "North Ground has no certified rules for this species in the selected jurisdiction."
                : "Ready. Check this hunt for the rules that apply on your date."}
            </p>

            <p className={styles.coverage}>
              {COVERAGE_SUMMARY}{" "}
              <Link href="/hunting/species/ruffed-grouse">What we cover →</Link>
            </p>
          </div>
        </div>

        <div className={styles.mapLayer}>
          <HuntMap
            exploration={exploration}
            dispatch={dispatch}
            zone={location ? resolvedZone : null}
            date={date}
            isToday={isToday}
            speciesOptions={speciesOptions}
            googleMapsApiKey={googleMapsApiKey}
            onContinueHunt={continueHunt}
            onConfirmPin={confirmPin}
            onNeighbour={setNeighbourLabel}
          />
        </div>
      </section>

      <div className={styles.resultsRegion} ref={resultRef} aria-live="polite">
        {evaluation.kind === "loading" ? (
          <div className={styles.results}>
            <div className={`${styles.skeleton} ng-glass-panel`} role="status">
              <p className="ng-visually-hidden">Checking official sources for this hunt.</p>
              <div className={styles.skeletonBar} style={{ width: "34%" }} aria-hidden="true" />
              <div className={styles.skeletonBar} style={{ width: "62%", height: 26 }} aria-hidden="true" />
              <div className={styles.skeletonBar} style={{ width: "80%" }} aria-hidden="true" />
              <div className={styles.skeletonBar} style={{ width: "48%" }} aria-hidden="true" />
            </div>
          </div>
        ) : null}

        {evaluation.kind === "error" ? (
          <div className={styles.results}>
            <p className={styles.errorNotice} role="alert">
              <strong>This hunt could not be checked.</strong>
              {evaluation.message} Your location and date are unchanged — try again.
            </p>
          </div>
        ) : null}

        {displayedResult && displayedResult.completeness === "NEEDS_INPUT" && displayedResult.required ? (
          <div className={styles.results}>
            <HuntQuestion
              dimension={displayedResult.required}
              answered={answeredSoFar}
              onAnswer={answerQuestion}
              disabled={busy}
            />
          </div>
        ) : null}

        {displayedResult && displayedResult.completeness === "RESOLVED" ? (
          <HuntResult
            result={displayedResult}
            speciesMedia={selectedSpecies?.image ?? null}
            placeLabel={location?.label ?? null}
            assumptions={answeredSoFar}
            onAnswer={answerQuestion}
          />
        ) : null}
      </div>
    </>
  );
}
