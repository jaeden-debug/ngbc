"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import type { PlaceSuggestion } from "../../../lib/hunt/location";
import type { StoredPlace } from "../../../lib/hunt/exploration/session-store";
import styles from "../HuntApp.module.css";

export interface ChosenPlace {
  label: string;
  latitude: number;
  longitude: number;
}

type ProviderState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "unavailable"; message: string };

const DEBOUNCE_MS = 260;
const MIN_QUERY_LENGTH = 2;

function newSessionToken(): string {
  // One token spans a whole search, so Google bills the session once rather than per keystroke.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Place search, as a map search: type a town, address, postal code or place,
 * pick a result, and the map goes there. Choosing a result is a deliberate
 * choice of hunt location; typing is not.
 *
 * Only the typed text is sent. Suggestions come from Google Places where it is
 * configured and a keyless provider otherwise, and the attribution follows
 * whichever answered. Nothing about the searcher's own position is sent.
 */
export default function PlaceComposer({
  value, onChoose, onUseMyLocation, onChooseOnMap, locating, locateMessage, autoFocus,
  recents, onClearRecents, open, onOpenChange, inputRef: externalRef,
}: {
  /** The hunt place this sheet is about, shown while the field is at rest. */
  value: string | null;
  onChoose: (place: ChosenPlace) => void;
  onUseMyLocation: () => void;
  onChooseOnMap: () => void;
  locating: boolean;
  locateMessage: string | null;
  autoFocus: boolean;
  recents: readonly StoredPlace[];
  onClearRecents: () => void;
  /** Open: the field is being used, so its ways of choosing a place are shown. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [state, setState] = useState<ProviderState>({ kind: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [provider, setProvider] = useState<"google" | "nominatim" | null>(null);

  const id = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? ownRef;
  const abortRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>("");
  const skipNextQueryRef = useRef(false);

  useEffect(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    // After the sheet has risen, so the keyboard does not push a moving target.
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [autoFocus, inputRef]);

  useEffect(() => {
    if (skipNextQueryRef.current) {
      skipNextQueryRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setState({ kind: "idle" });
      setActiveIndex(-1);
      return;
    }
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/hunt/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "suggest", query: trimmed, sessionToken: sessionTokenRef.current }),
          signal: controller.signal,
        });
        const payload = await response.json() as {
          status?: string; suggestions?: PlaceSuggestion[]; provider?: "google" | "nominatim"; message?: string; error?: string;
        };
        if (!response.ok || payload.status === "PROVIDER_ERROR" || payload.status === "NOT_CONFIGURED") {
          setSuggestions([]);
          setState({ kind: "unavailable", message: payload.message ?? payload.error ?? "Place search is unavailable right now. Try again, or choose a spot on the map." });
          return;
        }
        const next = payload.suggestions ?? [];
        setProvider(payload.provider ?? null);
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
        setState(next.length ? { kind: "idle" } : { kind: "empty" });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSuggestions([]);
        setState({ kind: "unavailable", message: "Place search is unavailable right now. Try again, or choose a spot on the map." });
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const choose = useCallback(async (suggestion: PlaceSuggestion) => {
    skipNextQueryRef.current = true;
    setQuery(suggestion.primary);
    setSuggestions([]);
    const label = [suggestion.primary, suggestion.secondary].filter(Boolean).join(", ");
    // The keyless provider returns the coordinate with the suggestion; no second trip.
    if (typeof suggestion.latitude === "number" && typeof suggestion.longitude === "number") {
      sessionTokenRef.current = newSessionToken();
      onChoose({ label, latitude: suggestion.latitude, longitude: suggestion.longitude });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/hunt/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve", placeId: suggestion.id, sessionToken: sessionTokenRef.current }),
      });
      const payload = await response.json() as { status?: string; place?: ChosenPlace; message?: string };
      if (payload.status !== "OK" || !payload.place) {
        setState({ kind: "unavailable", message: payload.message ?? "That place could not be found. Try another search." });
        return;
      }
      setState({ kind: "idle" });
      onChoose(payload.place);
    } catch {
      setState({ kind: "unavailable", message: "That place could not be found. Try another search." });
    } finally {
      sessionTokenRef.current = newSessionToken();
    }
  }, [onChoose]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setSuggestions([]);
      onOpenChange(false);
      inputRef.current?.blur();
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void choose(suggestions[activeIndex]);
    }
  }

  const status =
    state.kind === "unavailable" ? state.message
      : state.kind === "empty" ? "No matching place. Try a town, postal code or nearby landmark."
      : state.kind === "loading" ? "Searching…"
      : suggestions.length ? `${suggestions.length} ${suggestions.length === 1 ? "place" : "places"} found.`
      : "";

  return (
    <div className={styles.page}>
      {/* A search, not a form: Enter picks the highlighted place and nothing is ever submitted. */}
      <div className={styles.searchField} role="search">
        <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none">
          <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.7" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <label className="ng-visually-hidden" htmlFor={`${id}-input`}>Where are you hunting?</label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          className={styles.searchInput}
          type="search"
          enterKeyHint="search"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          /*
           * A chosen place is a VALUE, not a placeholder.
           *
           * It used to be shown as the placeholder, so the field read
           * "Maniwaki, La Vallée-de-la-Gatineau…" in placeholder grey — and
           * someone who had chosen Maniwaki could not tell their own choice
           * from a suggestion the field was making. The placeholder is a hint
           * now, and never a place: §41A already refuses to dress a row as a
           * place result, and the same holds for the field itself.
           */
          placeholder="Search anywhere"
          value={open ? query : value ?? ""}
          onFocus={() => onOpenChange(true)}
          aria-expanded={suggestions.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && suggestions.length ? `${id}-option-${activeIndex}` : undefined}
          aria-describedby={`${id}-status`}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {state.kind === "loading" ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {query && state.kind !== "loading" ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Clear search"
            onClick={() => { setQuery(""); setSuggestions([]); setState({ kind: "idle" }); inputRef.current?.focus(); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none">
              <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <>
      <p className={styles.searchStatus} id={`${id}-status`} role="status" data-tone={state.kind === "unavailable" ? "error" : undefined}>
        {status}
      </p>

      {suggestions.length ? (
        <ul className={styles.optionList} id={`${id}-list`} role="listbox" aria-label="Places">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="presentation">
              <button
                type="button"
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex || undefined}
                className={styles.optionRow}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void choose(suggestion)}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5c2.5 0 4.5 2 4.5 4.5 0 3.2-4.5 8.5-4.5 8.5S3.5 9.2 3.5 6c0-2.5 2-4.5 4.5-4.5Z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8" cy="6" r="1.6" fill="currentColor" />
                  </svg>
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionPrimary}>{suggestion.primary}</span>
                  {suggestion.secondary ? (
                    <>
                      {/* Read as "Bancroft, ON, Canada", not run together. */}
                      <span className="ng-visually-hidden">, </span>
                      <span className={styles.optionSecondary}>{suggestion.secondary}</span>
                    </>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {provider ? (
            <li role="presentation" className={styles.attribution}>
              {provider === "google" ? "Powered by Google" : "Place data © OpenStreetMap contributors"}
            </li>
          ) : null}
        </ul>
      ) : (
        <ul className={styles.optionList} aria-label="Other ways to choose a place">
          {recents.length ? (
            <>
              <li className={styles.optionGroup} role="presentation">
                <span>Recent</span>
                <button type="button" className={styles.optionGroupAction} onClick={onClearRecents}>Clear</button>
              </li>
              {recents.map((place) => (
                <li key={`${place.label}-${place.latitude}`}>
                  <button
                    type="button"
                    className={styles.optionRow}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { skipNextQueryRef.current = true; setQuery(""); onChoose(place); }}
                  >
                    <span className={styles.optionIcon} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M8 4.6V8l2.2 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className={styles.optionText}><span className={styles.optionPrimary}>{place.label}</span></span>
                  </button>
                </li>
              ))}
            </>
          ) : null}
          <li>
            <button type="button" className={styles.optionRow} onClick={onUseMyLocation} disabled={locating} aria-busy={locating || undefined}>
              <span className={styles.optionIcon} data-tone="location" aria-hidden="true">
                {locating ? <span className={styles.spinner} /> : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.5 1.5 9 14.5l-1.7-5.8L1.5 7 14.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                )}
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionPrimary}>{locating ? "Finding you…" : "Use my location"}</span>
                <span className={styles.optionSecondary}>Finds the official zone you are standing in</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className={styles.optionRow} onClick={onChooseOnMap}>
              <span className={styles.optionIcon} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M10 18.5s-5.6-6.3-5.6-10.6a5.6 5.6 0 0 1 11.2 0c0 4.3-5.6 10.6-5.6 10.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="10" cy="7.9" r="2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionPrimary}>Choose a spot on the map</span>
                <span className={styles.optionSecondary}>Move the map under the crosshair, then confirm</span>
              </span>
            </button>
          </li>
          {locateMessage ? <li className={styles.inlineNotice} role="status">{locateMessage}</li> : null}
        </ul>
      )}
        </>
      ) : locateMessage ? (
        <p className={styles.searchStatus} role="status" data-tone="error">{locateMessage}</p>
      ) : null}
    </div>
  );
}
