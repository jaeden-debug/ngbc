import {
  availableChoices, matchingOpportunities, type ResolvedOpportunity,
} from "../../../lib/hunt/regulatory/opportunity-row";
import {
  animalClassLabel, IMPLEMENT_LABELS, opportunityCard, type PresentedDimension,
} from "../../../lib/hunt/regulatory/opportunity-presentation";
import { opportunityTimeline, readingOrder, type TimelineState } from "../../../lib/hunt/regulatory/opportunity-timeline";
import styles from "./OpportunityRows.module.css";

/**
 * The opportunities in a zone, as rows a hunter can scan.
 *
 * WHAT THIS COMPONENT IS NOT ALLOWED TO DECIDE. Everything legally material is
 * settled before it arrives: which rows exist (`opportunity-adapter`), what each
 * row says (`opportunity-presentation`), which rows a filter admits
 * (`matchingOpportunities`), and how they group in time
 * (`opportunity-timeline`). This renders that and adds nothing — so a
 * jurisdiction with a different bundle shape needs no change here, and a
 * renderer cannot invent a friendlier answer than the law's.
 *
 * In particular it never writes "Either sex", "All methods", "No limit" or "No
 * permit required". Those are the four sentences the owner named: each is a
 * legal claim North Ground has no evidence for and each is one a hunter would
 * act on. An unestablished dimension arrives as `UNKNOWN` and is shown as such.
 *
 * `status` is deliberately absent. It is the regulatory engine's answer, and a
 * row carrying one would be a second place to decide legality.
 */

/** What each timeline band is called, in words rather than by colour (§48). */
const BAND_LABEL: Record<TimelineState, string> = {
  OPEN_ON_DATE: "Open on this date",
  OPENS_LATER: "Opens later",
  /* Not "closed" and not "over": North Ground cannot tell a season that ended
     from one whose next dates the authority has not published. */
  NO_FURTHER_PUBLISHED_WINDOW: "No further published season",
};

function Dimension({ label, presented }: { label: string; presented: PresentedDimension }) {
  if (presented.kind === "OMITTED") return null;
  return (
    <div className={styles.dimension}>
      <dt className={styles.dimensionLabel}>{label}</dt>
      <dd className={presented.kind === "UNKNOWN" ? styles.unknown : styles.dimensionValue}>
        {presented.text}
      </dd>
    </div>
  );
}

export interface OpportunityFilter {
  animalClass?: string | null;
  implement?: string | null;
}

export default function OpportunityRows({
  rows,
  date,
  filter = {},
  onFilterChange,
}: {
  rows: readonly ResolvedOpportunity[];
  /** The hunt date, ISO. Decides which band each opportunity falls in. */
  date: string;
  filter?: OpportunityFilter;
  /** Omitted on a server-rendered surface, where the controls are read-only. */
  onFilterChange?: (next: OpportunityFilter) => void;
}) {
  /* The choices come from the rows IN CONTEXT, never a declared list: a control
     offering a method no opportunity here supports answers "nothing" for a
     reason the hunter cannot see. */
  const choices = availableChoices(rows);
  const matching = matchingOpportunities(rows, filter);
  const entries = readingOrder(opportunityTimeline(matching, date));

  return (
    <section className={styles.rows} aria-labelledby="opportunity-rows-title">
      <h3 className={styles.title} id="opportunity-rows-title">What is open here</h3>

      {choices.animalClasses.length > 1 || choices.implements.length > 1 ? (
        <div className={styles.filters}>
          {choices.animalClasses.length > 1 ? (
            <label className={styles.filter}>
              <span className={styles.filterLabel}>Animal</span>
              <select
                className={styles.filterControl}
                value={filter.animalClass ?? ""}
                onChange={onFilterChange ? (event) => onFilterChange({ ...filter, animalClass: event.target.value || null }) : undefined}
                disabled={!onFilterChange}
              >
                <option value="">Any</option>
                {choices.animalClasses.map((token) => (
                  /* Through the shared labeller, because a class token may be
                     a compound ("ANTLERED or ANTLERLESS") and a map lookup
                     renders that one raw. */
                  <option key={token} value={token}>{animalClassLabel(token)}</option>
                ))}
              </select>
            </label>
          ) : null}
          {choices.implements.length > 1 ? (
            <label className={styles.filter}>
              <span className={styles.filterLabel}>Method</span>
              <select
                className={styles.filterControl}
                value={filter.implement ?? ""}
                onChange={onFilterChange ? (event) => onFilterChange({ ...filter, implement: event.target.value || null }) : undefined}
                disabled={!onFilterChange}
              >
                <option value="">Any</option>
                {choices.implements.map((token) => (
                  <option key={token} value={token}>{IMPLEMENT_LABELS[token] ?? token}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {entries.length === 0 ? (
        /*
         * A FILTER FINDING NOTHING IS NOT A CLOSED SEASON. Filtering is
         * affirmative — an opportunity whose method nobody has established
         * cannot satisfy a method filter — so an empty result can mean the law
         * says no OR that North Ground has not read it. Saying "closed" here
         * would put our silence where the law's answer belongs.
         */
        <p className={styles.empty}>
          {Object.values(filter).some(Boolean)
            ? "No opportunity here matches that combination. That can mean the rules do not allow it, or that North Ground has not established it — it is not a closed season."
            : "North Ground holds no structured opportunity for this species here yet."}
        </p>
      ) : null}

      {entries.map((entry) => {
        const card = opportunityCard(entry.rows[0]);
        return (
          <article key={entry.identity} className={styles.card} data-band={entry.state}>
            <p className={styles.band}>{BAND_LABEL[entry.state]}</p>
            <dl className={styles.dimensions}>
              <Dimension label="Animal" presented={card.animalClass} />
              <Dimension label="Measured as" presented={card.criterion} />
              {card.implements.kind === "VALUE" && card.implements.chips ? (
                <div className={styles.dimension}>
                  <dt className={styles.dimensionLabel}>Methods</dt>
                  <dd className={styles.chips}>
                    {card.implements.chips.map((chip) => <span key={chip} className={styles.chip}>{chip}</span>)}
                  </dd>
                </div>
              ) : (
                <Dimension label="Methods" presented={card.implements} />
              )}
            </dl>
            <ul className={styles.windows}>
              {entry.windows.map((window) => (
                <li key={`${window.opens}-${window.closes}`} className={styles.window}>
                  {window.opens} to {window.closes}
                </li>
              ))}
            </ul>
            {card.conditionIds.length ? (
              <p className={styles.conditions}>
                {card.conditionIds.length === 1 ? "1 condition applies" : `${card.conditionIds.length} conditions apply`}
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
