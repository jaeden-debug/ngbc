"use client";

import Link from "next/link";
import { useState } from "react";
import type { HuntEvaluation } from "../../../lib/hunt/types";
import styles from "./page.module.css";

function MapView({ result }: { result: HuntEvaluation }) {
  const rings = result.zone.displayRings ?? [];
  if (!rings.length) return <p>No boundary geometry is available for a visual map. The textual WMU result remains above.</p>;
  const points = rings.flat();
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const minX = Math.min(...longitudes);
  const maxX = Math.max(...longitudes);
  const minY = Math.min(...latitudes);
  const maxY = Math.max(...latitudes);
  const width = Math.max(maxX - minX, .0001);
  const height = Math.max(maxY - minY, .0001);
  const project = ([longitude, latitude]: number[]) => [((longitude - minX) / width) * 800, ((maxY - latitude) / height) * 480];
  const pin = project([result.input.longitude, result.input.latitude]);

  return (
    <svg className={styles.map} viewBox="0 0 800 480" role="img" aria-labelledby="map-title map-description">
      <title id="map-title">{result.zone.officialName} boundary and selected point</title>
      <desc id="map-description">The selected point is {result.zone.boundaryDistanceMeters?.toLocaleString()} metres from the nearest mapped boundary. This visual is not a legal survey.</desc>
      {rings.map((ring, index) => <polygon key={index} points={ring.map((position) => project(position).join(",")).join(" ")} />)}
      <circle cx={pin[0]} cy={pin[1]} r="7" />
    </svg>
  );
}

export default function HuntClient({ defaultDate }: { defaultDate: string }) {
  const [result, setResult] = useState<HuntEvaluation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(form: HTMLFormElement) {
    setLoading(true);
    setError("");
    const data = new FormData(form);
    try {
      const response = await fetch("/api/hunt/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latitude: Number(data.get("latitude")),
          longitude: Number(data.get("longitude")),
          date: String(data.get("date")),
          speciesId: "species:ruffed-grouse",
        }),
      });
      const payload = await response.json() as HuntEvaluation | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Hunt evaluation failed.");
      setResult(payload);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Hunt evaluation failed.");
    } finally {
      setLoading(false);
    }
  }

  function populateLocation(form: HTMLFormElement) {
    if (!navigator.geolocation) {
      setError("This browser does not provide location access. Enter coordinates instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = form.elements.namedItem("latitude") as HTMLInputElement;
        const longitude = form.elements.namedItem("longitude") as HTMLInputElement;
        latitude.value = coords.latitude.toFixed(6);
        longitude.value = coords.longitude.toFixed(6);
        setError("");
      },
      () => setError("Location access was unavailable or denied. Enter coordinates instead."),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <label className={styles.field}>Latitude<input name="latitude" type="number" min="41" max="57" step="any" defaultValue="45.23" required /></label>
        <label className={styles.field}>Longitude<input name="longitude" type="number" min="-96" max="-74" step="any" defaultValue="-77.94" required /></label>
        <label className={styles.field}>Date<input name="date" type="date" defaultValue={defaultDate} required /></label>
        <label className={styles.field}>Species<select name="species" defaultValue="ruffed-grouse"><option value="ruffed-grouse">Ruffed grouse</option></select></label>
        <div className={styles.actions}>
          <button className={styles.button} disabled={loading} type="submit">{loading ? "Checking official sources…" : "Evaluate this hunt"}</button>
          <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={(event) => populateLocation(event.currentTarget.form!)}>Use my location</button>
        </div>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {error && <p className={styles.error} role="alert">{error}</p>}
        {result && (
          <div className={styles.results}>
            <section className={styles.answer} data-status={result.regulation.status} aria-labelledby="regulatory-answer">
              <h2 id="regulatory-answer">Regulatory answer</h2>
              <p className={styles.status}>{result.regulation.status.replaceAll("_", " ")}</p>
              <p>{result.regulation.summary}</p>
              {result.regulation.season && <p><strong>Certified season:</strong> {result.regulation.season.opens} through {result.regulation.season.closes}, inclusive.</p>}
              {result.regulation.limits && <p><strong>Limits:</strong> {result.regulation.limits.daily} daily and {result.regulation.limits.possession} in possession, combined with {result.regulation.limits.combinedWith}.</p>}
              <p><strong>Legal-time rule:</strong> {result.regulation.legalTime.text}</p>
            </section>

            <div className={styles.grid}>
              <section className={styles.panel} aria-labelledby="location-result">
                <h2 id="location-result">Location and boundary</h2>
                <p><strong>{result.zone.officialName ?? "WMU not resolved"}</strong></p>
                <p>{result.zone.message}</p>
                {result.zone.boundaryDistanceMeters !== undefined && <p className={result.zone.nearBoundary ? styles.warning : undefined}>Nearest mapped boundary: approximately {result.zone.boundaryDistanceMeters.toLocaleString()} m.</p>}
                <MapView result={result} />
                <p><small>Text equivalent: {result.zone.status}; {result.zone.officialName ?? "no WMU"}; boundary distance {result.zone.boundaryDistanceMeters ?? "unknown"} metres; source accuracy {result.zone.locationAccuracy ?? "not reported"}.</small></p>
              </section>

              <section className={styles.panel} aria-labelledby="weather-result">
                <h2 id="weather-result">Weather context</h2>
                <p><strong>{result.weather.status}</strong></p>
                <p>{result.weather.summary}</p>
                {result.weather.sunrise && <p>Provider sunrise/sunset: {result.weather.sunrise.slice(11)} / {result.weather.sunset?.slice(11)} {result.weather.timezone}. These are environmental context, not certified legal times.</p>}
              </section>
            </div>

            <section className={styles.panel} aria-labelledby="knowledge-result">
              <h2 id="knowledge-result">North Ground knowledge</h2>
              <p>Editorial guidance is retrieved from the canonical species record. It cannot change the regulatory result above.</p>
              <div className={styles.knowledge}>
                {result.knowledge.blocks.map(({ block, matchReasons }) => (
                  <article key={block.id}>
                    <h3>{block.type.replaceAll("_", " ")}</h3>
                    <p>{block.content.plainText}</p>
                    <small>Matched: {matchReasons.join(", ") || "general context"}</small>
                  </article>
                ))}
              </div>
              <p><Link className={styles.speciesLink} href={result.species.canonicalPath}>Learn about ruffed grouse</Link></p>
            </section>

            <section className={styles.panel} aria-labelledby="sources-result">
              <h2 id="sources-result">Sources and limitations</h2>
              <ul>
                {result.regulation.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
                {result.regulation.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
              <ol className={styles.sources}>
                {result.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className={styles.sourceMeta}>{source.publisher} · {source.verificationStatus}</span></li>)}
              </ol>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
