"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import SpeciesPrimaryImage, { SpeciesImagePlaceholder } from "../../../components/species/SpeciesPrimaryImage";
import type { SpeciesPrimaryMedia } from "../../../lib/species-media/types";
import styles from "./page.module.css";

export interface LibrarySpecies {
  id: string;
  commonName: string;
  scientificName: string;
  frenchName: string | null;
  category: string;
  canonicalUrl: string;
  searchTerms: string[];
  regulatoryJurisdictions: string[];
  image: SpeciesPrimaryMedia | null;
}

type UploadState = "IMAGE_SET" | "MISSING_IMAGE" | "UPLOADING" | "ERROR";
const normalize = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en-CA");
const ALL = "All";

/** The card's drawn width at each grid breakpoint (page.module.css), for the photo's srcset. */
const CARD_IMAGE_SIZES = "(min-width: 1200px) 25vw, (min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw";

/**
 * What the administrator is told when an upload is refused. A validation
 * failure names what to change; a transient failure says to try again, because
 * nothing about the image was wrong. Every failure leaves the current primary
 * image unchanged.
 */
function uploadErrorMessage(code: string | undefined, status: number | undefined): string {
  switch (code) {
    case "PRIMARY_MEDIA_CHANGED":
    case "REPLACE_CONFIRMATION_REQUIRED":
      return "The primary image changed. Refresh before replacing it.";
    case "TOO_LARGE":
    case "PAYLOAD_TOO_LARGE":
      return "Use an image smaller than 12 MB.";
    case "UNSUPPORTED":
      return "Use JPEG, PNG, WebP or AVIF.";
    case "ANIMATED":
      return "Use a single still image, not an animation.";
    case "EMPTY":
    case "INVALID":
      return "This file could not be read as an image.";
    case "UNAUTHORIZED":
      return "Your administrator session has ended. Sign in again.";
    case "RATE_LIMITED":
      return "Too many uploads this hour. Try again later.";
    case "UNKNOWN_SPECIES":
      return "This species is not in the published library.";
    default:
      return status === 503 || status === undefined
        ? "North Ground is temporarily busy. Nothing was changed — try again in a moment."
        : "Upload failed. The existing primary image was not changed.";
  }
}

export default function SpeciesLibrary({ species, adminMode = false }: { species: LibrarySpecies[]; adminMode?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [items, setItems] = useState(species);
  const [missingOnly, setMissingOnly] = useState(false);
  const [draggingOver, setDraggingOver] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, UploadState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [replacement, setReplacement] = useState<{ item: LibrarySpecies; file: File; preview: string } | null>(null);
  const replacementDialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!replacement) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = replacementDialogRef.current;
    requestAnimationFrame(() => dialog?.querySelector<HTMLButtonElement>("button")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelReplacement();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  // `cancelReplacement` only clears this modal and is intentionally read at event time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replacement]);

  const searched = useMemo(() => {
    const needle = normalize(query.trim());
    const pool = missingOnly ? items.filter((item) => !item.image) : items;
    return needle ? pool.filter((item) => item.searchTerms.some((term) => normalize(term).includes(needle))) : pool;
  }, [query, items, missingOnly]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of searched) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [{ name: ALL, count: searched.length }, ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en-CA"))
      .map(([name, count]) => ({ name, count }))];
  }, [searched]);
  const visible = useMemo(() => category === ALL ? searched : searched.filter((item) => item.category === category), [category, searched]);
  const filtering = Boolean(query.trim()) || category !== ALL || missingOnly;

  async function upload(item: LibrarySpecies, file: File, expectedCurrentAssetId: string | null) {
    setStates((current) => ({ ...current, [item.id]: "UPLOADING" }));
    setErrors((current) => ({ ...current, [item.id]: "" }));
    const form = new FormData();
    form.set("speciesId", item.id);
    form.set("image", file);
    form.set("sourceType", "north_ground");
    if (expectedCurrentAssetId) form.set("expectedCurrentAssetId", expectedCurrentAssetId);
    const response = await fetch("/api/admin/species-media", { method: "POST", body: form }).catch(() => null);
    const payload = await response?.json().catch(() => null) as { media?: SpeciesPrimaryMedia; code?: string } | null;
    if (!response?.ok || !payload?.media) {
      setStates((current) => ({ ...current, [item.id]: "ERROR" }));
      setErrors((current) => ({ ...current, [item.id]: uploadErrorMessage(payload?.code, response?.status) }));
      return;
    }
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, image: payload.media! } : entry));
    setStates((current) => ({ ...current, [item.id]: "IMAGE_SET" }));
  }

  function acceptDrop(item: LibrarySpecies, file: File | undefined) {
    setDraggingOver(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
      setStates((current) => ({ ...current, [item.id]: "ERROR" }));
      setErrors((current) => ({ ...current, [item.id]: "Use JPEG, PNG, WebP or AVIF." }));
    } else if (item.image) {
      setReplacement({ item, file, preview: URL.createObjectURL(file) });
    } else void upload(item, file, null);
  }

  function cancelReplacement() {
    if (replacement) URL.revokeObjectURL(replacement.preview);
    setReplacement(null);
  }

  return <>
    <section className={`${styles.controls} ng-glass-panel`} aria-labelledby="find-heading">
      <h2 className="ng-visually-hidden" id="find-heading">Find a species</h2>
      <label className="ng-visually-hidden" htmlFor="species-search">Search species by common, scientific, French or hunter name</label>
      <div className={styles.searchField}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" fill="none"><circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.5" /><path d="m12.2 12.2 3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input className={styles.search} id="species-search" type="search" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="wolf, doe, orignal, Canard colvert…" />
      </div>
      <div className={styles.filters} role="group" aria-label="Filter species">
        {categories.map((item) => <button key={item.name} type="button" className={styles.filter} aria-pressed={category === item.name} onClick={() => setCategory(item.name)}>
          {item.name}<span className={styles.filterCount}>{item.count}</span>
        </button>)}
        {adminMode ? <button type="button" className={styles.filter} aria-pressed={missingOnly} onClick={() => { setMissingOnly((value) => !value); setCategory(ALL); }}>
          Missing images <span className={styles.filterCount}>{items.filter((item) => !item.image).length}</span>
        </button> : null}
      </div>
    </section>

    <p className={styles.resultLine} aria-live="polite"><span>{visible.length} species{category === ALL ? "" : ` in ${category}`}</span>
      {filtering ? <button type="button" className={styles.reset} onClick={() => { setQuery(""); setCategory(ALL); setMissingOnly(false); }}>Clear</button> : null}
    </p>
    <h2 className="ng-visually-hidden" id="results-heading">Species</h2>
    {visible.length ? <ul className={styles.grid} aria-labelledby="results-heading">
      {visible.map((item, index) => {
        const state = states[item.id] ?? (item.image ? "IMAGE_SET" : "MISSING_IMAGE");
        return <li key={item.id} className={`${styles.card} ng-glass-card`} data-admin={adminMode || undefined} data-drag-over={draggingOver === item.id || undefined}
          onDragEnter={adminMode ? (event) => { event.preventDefault(); setDraggingOver(item.id); } : undefined}
          onDragOver={adminMode ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } : undefined}
          onDragLeave={adminMode ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingOver(null); } : undefined}
          onDrop={adminMode ? (event) => { event.preventDefault(); acceptDrop(item, event.dataTransfer.files[0]); } : undefined}>
          <Link className={styles.cardLink} href={item.canonicalUrl} onClick={state === "UPLOADING" ? (event) => event.preventDefault() : undefined}>
            {/* The photograph fills the card; the first row is above the fold on every width. */}
            {item.image
              ? <SpeciesPrimaryImage className={styles.cardMedia} media={item.image} variant="card" sizes={CARD_IMAGE_SIZES} loading={index < 4 ? "eager" : "lazy"} />
              : <SpeciesImagePlaceholder className={`${styles.cardMedia} ${styles.cardPlaceholder}`} label={item.commonName} />}
            {/* Densest glass: measured AA for every line over the brightest part of all 57 photos. */}
            <span className={`${styles.cardPanel} ng-glass-popover ng-glass-dense`}>
              <span className={styles.cardCategory}>{item.category}</span>
              <span className={styles.cardName}>{item.commonName}</span><span className={styles.cardScientific}>{item.scientificName}</span>
              {item.frenchName ? <span className={styles.cardFrench}>{item.frenchName}</span> : null}
              <span className={styles.cardFoot}><span className="ng-coverage" data-coverage={item.regulatoryJurisdictions.length ? "VERIFIED" : "IN_DEVELOPMENT"}>
                {item.regulatoryJurisdictions.length ? `Rules: ${item.regulatoryJurisdictions.join(", ")}` : "Knowledge profile · no certified rules"}
              </span></span>
            </span>
          </Link>
          {adminMode ? <div className={`${styles.adminState} ng-glass-overlay`} data-state={state} role="status">{state.replaceAll("_", " ")}{errors[item.id] ? <span>{errors[item.id]}</span> : null}</div> : null}
        </li>;
      })}
    </ul> : <div className={`${styles.empty} ng-glass-card`}><p className={styles.emptyTitle}>No published species matches that search</p><p className={styles.emptyNote}>Try a common, scientific, French or hunter name. Research-only records are not published here.</p></div>}

    {replacement ? <div className={styles.replaceBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelReplacement(); }}>
      <section ref={replacementDialogRef} className={`${styles.replaceDialog} ng-glass-panel`} role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <h2 id="replace-title">Replace primary image for {replacement.item.commonName}?</h2>
        <div className={styles.replaceCompare}>
          <div><span className="ng-label">Current image</span>{replacement.item.image ? <SpeciesPrimaryImage media={replacement.item.image} variant="card" className={styles.replaceImage} /> : null}</div>
          <div><span className="ng-label">New image</span><Image src={replacement.preview} alt="New upload preview" width={480} height={320} unoptimized className={styles.replaceImage} /></div>
        </div>
        <div className={styles.replaceActions}><button type="button" className="ng-action" onClick={() => { const pending = replacement; cancelReplacement(); void upload(pending.item, pending.file, pending.item.image?.assetId ?? null); }}>Replace</button><button type="button" className="ng-action-quiet" onClick={cancelReplacement}>Cancel</button></div>
      </section>
    </div> : null}
  </>;
}
