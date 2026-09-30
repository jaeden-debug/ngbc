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
  seasonalBasis?: { warning?: string };
  latestObservationYear: number;
  zoneObservationYear?: number;
}

/**
 * The figures a unit's card shows, and what each one is not. A harvest total
 * is a record of hunting; a density is an estimate of animals — both for the
 * whole unit, and neither able to say where inside it the animals are.
 */
const FIGURES: Record<string, { heading: string; isNot: string }> = {
  POPULATION_DENSITY: {
    heading: "Aerial survey",
    isNot: "An estimate for the whole unit from the province's aerial survey; it cannot say where inside the unit the animals are.",
  },
  HARVEST_TOTAL: {
    heading: "Harvest records",
    isNot: "A record of hunting in the whole unit, not a count of animals, and it cannot say where inside the unit they are.",
  },
};

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
  const shown = reply?.result.components.filter((component) => FIGURES[component.metric] && component.explanation) ?? [];
  if (!reply || !shown.length) return null;
  /* One unit, one kind of figure: a bundle carries harvest or a survey, and the
     heading and caveat belong to whichever it is. */
  const kind = FIGURES[shown[0].metric];

  return (
    <section className={styles.block} aria-labelledby="zone-evidence-title" data-zone-evidence="" data-evidence-metric={shown[0].metric}>
      <h3 className={styles.blockTitle} id="zone-evidence-title">
        {kind.heading} for {zoneLabel}, {reply.zoneObservationYear ?? reply.latestObservationYear}
      </h3>
      <ul className={styles.conditionList}>
        {shown.map((component) => <li key={component.explanation}>{component.explanation}</li>)}
      </ul>
      <p className={styles.conditionWhere}>
        {kind.isNot}
        {reply.seasonalBasis?.warning ? ` ${reply.seasonalBasis.warning}` : ""}
        {" "}
        <a href={reply.source.url} target="_blank" rel="noopener noreferrer">
          {reply.source.title} <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  );
}
