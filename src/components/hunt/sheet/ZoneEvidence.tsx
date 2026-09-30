"use client";

import { useEffect, useState } from "react";
import styles from "./Answer.module.css";

/**
 * What the authority recorded about this species in THIS unit, in its own
 * figures — the zone evidence the map may not paint.
 *
 * WHY IT IS HERE. For moose, deer, bear and elk the evidence North Ground holds
 * is one figure per management unit: "47 estimated harvested moose; 1,035
 * estimated active resident hunters". §41B forbids painting it — a figure for a
 * whole unit cannot say where inside the unit the animals are — and when the
 * zone-shaded heat was removed, nothing else showed it, so a moose hunter got
 * a blank map and no numbers at all. The unit's card is where a whole-unit
 * figure is true, so this is where it goes.
 *
 * WHAT IT DOES NOT SHOW. No class, no rank, no shade: the endpoint's ranked
 * intensity is the choropleth that was retired, and a "HIGH" beside a unit
 * would repaint it in words. Only the authority's own counts, the year they
 * describe, the source, and what they are not: a record of hunting, not a
 * count of animals. Derived ratios stay out too; the card has room for the
 * figures, and a ratio without its denominator is how a total quietly becomes
 * a rate.
 */

interface EvidenceReply {
  result: {
    components: Array<{ metric: string; explanation?: string }>;
  };
  source: { authority: string; title: string; url: string };
  latestObservationYear: number;
}

const FIGURES = new Set(["HARVEST_TOTAL"]);

export default function ZoneEvidence({ speciesId, geographyId, zoneLabel }: {
  speciesId: string;
  geographyId: string;
  zoneLabel: string;
}) {
  const key = `${speciesId}|${geographyId}`;
  const [held, setHeld] = useState<{ key: string; reply: EvidenceReply | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const url = `/api/hunt/opportunity?speciesId=${encodeURIComponent(speciesId)}&geographyId=${encodeURIComponent(geographyId)}`;
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        /* 404 is "no record for this unit": nothing is shown, and nothing is
           claimed — the status and conditions above stand on their own. */
        const reply = response.ok ? await response.json() as EvidenceReply : null;
        setHeld({ key, reply });
      })
      .catch(() => { /* A failed read shows nothing rather than a guess. */ });
    return () => controller.abort();
  }, [key, speciesId, geographyId]);

  const reply = held?.key === key ? held.reply : null;
  const lines = reply?.result.components
    .filter((component) => FIGURES.has(component.metric) && component.explanation)
    .map((component) => component.explanation!) ?? [];
  if (!reply || !lines.length) return null;

  return (
    <section className={styles.block} aria-labelledby="zone-evidence-title" data-zone-evidence="">
      <h3 className={styles.blockTitle} id="zone-evidence-title">
        Harvest records for {zoneLabel}, {reply.latestObservationYear}
      </h3>
      <ul className={styles.conditionList}>
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className={styles.conditionWhere}>
        A record of hunting in the whole unit, not a count of animals, and it cannot say where inside the unit they are.
        {" "}
        <a href={reply.source.url} target="_blank" rel="noopener noreferrer">
          {reply.source.authority} <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  );
}
