"use client";

import { useEffect, useReducer, useState } from "react";
import {
  ISSUER_DIRECTORIES, issuerAdvice, issuerMapUrl, nearestIssuers, vendorSearchReducer,
  type IssuerDirectory, type NearbyIssuer,
} from "../../lib/hunt/readiness/vendors";
import LocationSearch from "./LocationSearch";
import styles from "./ReadyToHunt.module.css";

/**
 * Where to buy a licence in person.
 *
 * This component has no way to read or change the hunt location: it receives
 * no hunt coordinates and no setter, and its own position lives only in its
 * local reducer. The device is asked for its position only when the hunter
 * presses the button, once, and the answer is used here, in the browser, to
 * sort the province's published issuer list. It is never sent anywhere, stored,
 * or added to a Hunt Brief.
 */

const DEVICE_MESSAGES = {
  DENIED: "Location permission is off, so search for a town, address or postal code instead.",
  UNAVAILABLE: "Your device could not find its location. Search for a town, address or postal code instead.",
} as const;

export default function VendorSearch({ directoryId, attribution }: { directoryId: string; attribution: string }) {
  const [state, dispatch] = useReducer(vendorSearchReducer, { phase: "IDLE" });
  const [directory, setDirectory] = useState<IssuerDirectory | null>(null);
  const [failed, setFailed] = useState(false);
  const load = ISSUER_DIRECTORIES[directoryId];
  const loadError = failed || !load;

  // The issuer list is loaded only once someone asks for a vendor.
  const wanted = state.phase !== "IDLE";
  useEffect(() => {
    if (!wanted || directory || !load) return;
    let cancelled = false;
    load().then((value) => { if (!cancelled) setDirectory(value); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [wanted, directory, load]);

  function locateDevice() {
    dispatch({ type: "USE_DEVICE" });
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      dispatch({ type: "DEVICE_FAILED", code: 2 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => dispatch({ type: "DEVICE_LOCATED", latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => dispatch({ type: "DEVICE_FAILED", code: error.code }),
      // A town-level fix is plenty for "which issuer is near"; no need for GPS precision.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const results: NearbyIssuer[] = state.phase === "RESULTS" && directory ? nearestIssuers(state.location, directory.issuers, 5) : [];

  return (
    <div className={styles.vendor}>
      <h4 className={styles.subhead}>Buy in person</h4>
      <p className={styles.note}>
        Your current location is used only to find nearby licence vendors. It won&apos;t change your hunting location.
      </p>
      <div className={styles.vendorActions}>
        <button type="button" className={styles.action} onClick={locateDevice} disabled={state.phase === "LOCATING"}>
          {state.phase === "LOCATING" ? "Finding your location…" : "Find a licence vendor near me"}
        </button>
        {state.phase !== "SEARCHING" ? (
          <button type="button" className={styles.actionQuiet} onClick={() => dispatch({ type: "SEARCH_ANOTHER_PLACE" })}>
            Search another location
          </button>
        ) : null}
      </div>

      {state.phase === "SEARCHING" ? (
        <div className={styles.vendorSearch}>
          {state.reason ? <p className={styles.note} role="status">{DEVICE_MESSAGES[state.reason]}</p> : null}
          <LocationSearch
            label="Find licence vendors near"
            selectedLabel={null}
            onSelect={(place) => dispatch({ type: "PLACE_CHOSEN", latitude: place.latitude, longitude: place.longitude, label: place.label })}
          />
        </div>
      ) : null}

      {state.phase === "RESULTS" ? (
        <div className={styles.vendorResults} aria-live="polite">
          {loadError ? (
            <p className={styles.note}>The issuer list could not be loaded. Use the online or phone options above.</p>
          ) : !directory ? (
            <p className={styles.note}>Loading licence issuers…</p>
          ) : (
            <>
              <p className={styles.note}>
                Nearest issuers to {state.location.origin === "DEVICE" ? "your current location" : state.location.label}:
              </p>
              <ol className={styles.vendorList}>
                {results.map(({ issuer, distanceKm }) => {
                  const advice = issuerAdvice(issuer);
                  const web = issuer.webLink?.startsWith("https://") || issuer.webLink?.startsWith("http://") ? issuer.webLink : undefined;
                  return (
                    <li key={`${issuer.name}-${issuer.latitude}-${issuer.longitude}`}>
                      <strong>{issuer.name}</strong>
                      <span className={styles.meta}>
                        {[issuer.address, issuer.city].filter(Boolean).join(", ")} · about {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km
                        {issuer.type ? ` · ${issuer.type}` : ""}
                      </span>
                      {advice ? <span className={styles.meta}>{advice}</span> : null}
                      <span className={styles.links}>
                        <a href={issuerMapUrl(issuer)} target="_blank" rel="noopener noreferrer">Directions</a>
                        {web ? <a href={web} target="_blank" rel="noopener noreferrer">Website</a> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.meta}>
                Listed by Ontario as hunting and fishing licence issuers. Call ahead to confirm hours and that they
                issue the licence you need. {attribution}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
