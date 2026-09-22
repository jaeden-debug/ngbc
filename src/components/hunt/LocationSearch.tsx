"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PlaceSuggestion } from "../../lib/hunt/location";
import styles from "./LocationSearch.module.css";

export interface SelectedLocation {
  label: string;
  latitude: number;
  longitude: number;
  /** How the coordinate was obtained, so the interface can describe it honestly. */
  origin: "search" | "device";
}

interface LocationSearchProps {
  onSelect: (location: SelectedLocation) => void;
  selectedLabel: string | null;
  disabled?: boolean;
  /** The question this search answers. Hunt's own search asks where the hunt is. */
  label?: string;
}

type ProviderState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "unavailable"; message: string };

const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

function newSessionToken(): string {
  // Matches the server's session-token pattern; one token spans a whole search so
  // Google bills the session once rather than once per keystroke.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export default function LocationSearch({ onSelect, selectedLabel, disabled, label = "Where are you hunting?" }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [state, setState] = useState<ProviderState>({ kind: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"google" | "nominatim" | null>(null);

  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(newSessionToken());
  // Suppresses the fetch that a programmatic setQuery would otherwise trigger.
  const skipNextQueryRef = useRef(false);

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

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
      closeList();
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: "loading" });

      try {
        const response = await fetch("/api/hunt/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "suggest",
            query: trimmed,
            sessionToken: sessionTokenRef.current,
          }),
          signal: controller.signal,
        });
        const payload = await response.json() as {
          status?: string;
          suggestions?: PlaceSuggestion[];
          provider?: "google" | "nominatim";
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          setSuggestions([]);
          setState({
            kind: "unavailable",
            message: payload.error ?? "Place search is unavailable right now.",
          });
          setOpen(false);
          return;
        }

        if (payload.status === "PROVIDER_ERROR" || payload.status === "NOT_CONFIGURED") {
          setSuggestions([]);
          setState({
            kind: "unavailable",
            message: payload.message ?? "Place search is unavailable right now.",
          });
          setOpen(false);
          return;
        }

        const next = payload.suggestions ?? [];
        setProvider(payload.provider ?? null);
        setSuggestions(next);
        setActiveIndex(-1);
        setState(next.length ? { kind: "idle" } : { kind: "empty" });
        setOpen(next.length > 0);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSuggestions([]);
        setState({ kind: "unavailable", message: "Place search is unavailable right now." });
        setOpen(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, closeList]);

  const choose = useCallback(
    async (suggestion: PlaceSuggestion) => {
      closeList();
      skipNextQueryRef.current = true;
      setQuery(suggestion.primary);

      // Nominatim returns the coordinate with the suggestion, so no second
      // round-trip is spent resolving something already resolved.
      if (typeof suggestion.latitude === "number" && typeof suggestion.longitude === "number") {
        onSelect({
          label: [suggestion.primary, suggestion.secondary].filter(Boolean).join(", "),
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          origin: "search",
        });
        sessionTokenRef.current = newSessionToken();
        return;
      }

      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/hunt/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "resolve",
            placeId: suggestion.id,
            sessionToken: sessionTokenRef.current,
          }),
        });
        const payload = await response.json() as {
          status?: string;
          place?: { label: string; latitude: number; longitude: number };
          message?: string;
        };

        if (payload.status !== "OK" || !payload.place) {
          setState({
            kind: "unavailable",
            message: payload.message ?? "That place could not be resolved. Try another search.",
          });
          return;
        }

        setState({ kind: "idle" });
        onSelect({ ...payload.place, origin: "search" });
      } catch {
        setState({ kind: "unavailable", message: "That place could not be resolved. Try another search." });
      } finally {
        // A resolved place closes the billing session; the next search starts a new one.
        sessionTokenRef.current = newSessionToken();
      }
    },
    [closeList, onSelect],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeList();
      return;
    }
    if (!open || !suggestions.length) {
      if (event.key === "ArrowDown" && suggestions.length) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void choose(suggestions[activeIndex]);
    }
  }

  const statusMessage =
    state.kind === "unavailable" ? state.message
      : state.kind === "empty" ? "No matching place. Try a town, postal code or a nearby landmark."
      : selectedLabel ? `Selected ${selectedLabel}.`
      : "";

  return (
    <div className={styles.field}>
      <label className="ng-label" htmlFor={`${listboxId}-input`}>
        {label}
      </label>

      <div className={styles.searchWrap}>
        <div className={`${styles.searchInputRow} ng-glass-control`}>
          <svg className={styles.searchIcon} width="17" height="17" viewBox="0 0 20 20" aria-hidden="true" fill="none">
            <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.6" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            className={styles.searchInput}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            placeholder="Search a location, town, address or postal code"
            value={query}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
            aria-describedby={statusId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (suggestions.length) setOpen(true); }}
            onBlur={() => { window.setTimeout(closeList, 140); }}
          />

          {state.kind === "loading" ? <span className={styles.spinner} aria-hidden="true" /> : null}

          {query && state.kind !== "loading" ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label="Clear location search"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setState({ kind: "idle" });
                closeList();
                inputRef.current?.focus();
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none">
                <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        {open && suggestions.length ? (
          <ul className={`${styles.suggestions} ng-glass-popover`} id={listboxId} role="listbox" aria-label="Location suggestions">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  className={styles.suggestion}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void choose(suggestion)}
                >
                  <svg className={styles.suggestionIcon} width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none">
                    <path d="M8 1.5c2.5 0 4.5 2 4.5 4.5 0 3.2-4.5 8.5-4.5 8.5S3.5 9.2 3.5 6c0-2.5 2-4.5 4.5-4.5Z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8" cy="6" r="1.6" fill="currentColor" />
                  </svg>
                  <span className={styles.suggestionText}>
                    <span className={styles.suggestionPrimary}>{suggestion.primary}</span>
                    {suggestion.secondary ? (
                      <span className={styles.suggestionSecondary}>{suggestion.secondary}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
            {provider ? (
              <li role="presentation">
                <p className={styles.attribution}>
                  {provider === "google"
                    ? "Powered by Google"
                    : "Place data \u00a9 OpenStreetMap contributors"}
                </p>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <p
        className={styles.searchNote}
        id={statusId}
        data-tone={state.kind === "unavailable" ? "error" : undefined}
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>
    </div>
  );
}
