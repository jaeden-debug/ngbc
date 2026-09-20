"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayIso } from "../../lib/hunt/date";
import { COVERAGE_SUMMARY, isWithinSupportedBounds, type SupportedSpeciesId } from "../../lib/hunt/coverage";
import { COVERAGE_WORDING } from "../../lib/hunt/zone-layers";
import type { HuntEvaluation } from "../../lib/hunt/types";
import DateField from "./DateField";
import HuntMap, { type ResolvedZone } from "./HuntMap";
import HuntResult from "./HuntResult";
import LocationSearch, { type SelectedLocation } from "./LocationSearch";
import SpeciesSelect from "./SpeciesSelect";
import styles from "./Hunt.module.css";

type LocateState = { kind: "idle" } | { kind: "locating" } | { kind: "error"; message: string };

type ZoneState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "resolved"; zone: ResolvedZone; jurisdiction: string }
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
export default function HuntComposer({ googleMapsApiKey }: { googleMapsApiKey?: string }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [date, setDate] = useState<string>(() => todayIso());
  const [speciesId, setSpeciesId] = useState<SupportedSpeciesId | null>(null);
  const [locateState, setLocateState] = useState<LocateState>({ kind: "idle" });
  const [zoneState, setZoneState] = useState<ZoneState>({ kind: "idle" });
  const [evaluation, setEvaluation] = useState<EvaluationState>({ kind: "idle" });

  const resultRef = useRef<HTMLDivElement>(null);
  const zoneRequestRef = useRef(0);

  const outsideCoverage = Boolean(location) && !isWithinSupportedBounds(location!.latitude, location!.longitude);
  const resolvedZone = zoneState.kind === "resolved" ? zoneState.zone : null;

  /* A stable object, so the map's marker and centring effects run when the place
     changes rather than on every keystroke elsewhere in the composer. */
  const point = useMemo(
    () => (location ? { latitude: location.latitude, longitude: location.longitude } : null),
    [location],
  );

  /* ── Location → zone, before any species or date ───────────────────────── */

  useEffect(() => {
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
          zone?: ResolvedZone; layer?: { jurisdictionName: string };
        };
        if (id !== zoneRequestRef.current) return;

        if (payload.status === "RESOLVED" && payload.zone) {
          setZoneState({
            kind: "resolved",
            zone: payload.zone,
            jurisdiction: payload.layer?.jurisdictionName ?? "",
          });
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
  }, [location]);

  const selectLocation = useCallback((next: SelectedLocation) => {
    setLocation(next);
    setLocateState({ kind: "idle" });
    // A new place invalidates the previous regulatory answer, never the map.
    setEvaluation({ kind: "idle" });
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
        let label = "Your current location";
        try {
          const response = await fetch("/api/hunt/location", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "describe", latitude, longitude }),
          });
          const payload = await response.json() as { status?: string; place?: { label: string } };
          if (payload.status === "OK" && payload.place?.label) label = payload.place.label;
        } catch {
          /* A missing label never blocks a resolved coordinate. */
        }
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
  }, [selectLocation]);

  const checkHunt = useCallback(async () => {
    if (!location || !speciesId || outsideCoverage) return;
    setEvaluation({ kind: "loading" });
    try {
      const response = await fetch("/api/hunt/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude, longitude: location.longitude, date, speciesId,
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
  }, [location, speciesId, outsideCoverage, date]);

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
              {locateState.kind === "locating" ? "Finding you…" : "Use my location"}
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
                        <strong>Close to a zone boundary.</strong>{" "}
                        {zoneState.zone.boundaryDistanceMeters !== undefined
                          ? `About ${zoneState.zone.boundaryDistanceMeters.toLocaleString("en-CA")} m from the mapped line. `
                          : ""}
                        Rules can differ on the other side, and consumer GPS is not a legal position fix.
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
                      <dd>{location.origin === "device" ? "Device location" : "Place search"}</dd>
                    </div>
                  </dl>
                </details>
              </div>
            ) : null}

            <DateField value={date} onChange={setDate} disabled={busy} />

            <SpeciesSelect value={speciesId} onChange={setSpeciesId} disabled={busy} />

            {outsideCoverage ? (
              <p className={styles.coverageWarning} role="status">
                <strong>That location is outside current coverage.</strong>
                North Ground can check hunts in Ontario today. This is a gap in our
                coverage, not a statement about hunting there.
              </p>
            ) : null}

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void checkHunt()}
              disabled={!location || !speciesId || outsideCoverage || busy}
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
            point={point}
            placeLabel={location?.label ?? null}
            zone={resolvedZone}
            googleMapsApiKey={googleMapsApiKey}
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

        {displayedResult ? (
          <HuntResult result={displayedResult} placeLabel={location?.label ?? null} />
        ) : null}
      </div>
    </>
  );
}
