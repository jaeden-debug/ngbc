import Link from "next/link";
import type { ShareHuntBrief } from "../../lib/hunt-share/model.ts";
import { checkCurrentHuntPath } from "../../lib/hunt-share/urls.ts";
import { briefZoneLabels } from "../../lib/hunt-share/zone-label.ts";
import styles from "./HuntBrief.module.css";

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  );
}

function statusClass(status: ShareHuntBrief["regulatory"]["status"]): string {
  return {
    OPEN: styles.statusOpen,
    CLOSED: styles.statusClosed,
    CONDITIONAL: styles.statusConditional,
    UNKNOWN: styles.statusUnknown,
    CONFLICT: styles.statusConflict,
    NEEDS_VERIFICATION: styles.statusNeedsVerification,
  }[status];
}

function statusLabel(status: ShareHuntBrief["regulatory"]["status"]): string {
  return status === "NEEDS_VERIFICATION" ? "Needs verification" : status.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

/* Status is always a word, never only a colour. */
const AUTHORIZATION_STATUS_LABEL = { REQUIRED: "Required", CONDITIONAL: "Depends", UNKNOWN: "Unknown" } as const;
const ORANGE_STATUS_LABEL = { REQUIRED: "Required", NOT_REQUIRED: "Not required", CONDITIONAL: "Depends", UNKNOWN: "Unknown" } as const;

export default function HuntBriefCard({ brief }: { brief: ShareHuntBrief }) {
  const date = formatDate(brief.selectedDate, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const zone = briefZoneLabels(brief.managementZone);

  return (
    <article className={styles.card}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>North Ground Hunt · Shared brief</p>
        <h1 className={styles.title}>{brief.species.displayName}</h1>
        <p className={styles.context}>
          <span>
            {zone ? zone.label : "Management zone unresolved"}
            {/* The authority's own name stays visible beside the readable one. */}
            {zone?.officialNameAddsInformation && <> ({zone.officialName})</>}
          </span>
          <span>{brief.jurisdiction.displayName}</span>
          <span>{date}</span>
          {brief.generalLocationLabel && <span>{brief.generalLocationLabel}</span>}
        </p>
        <div className={styles.statusRow}>
          <strong className={`${styles.status} ${statusClass(brief.regulatory.status)}`}>
            {statusLabel(brief.regulatory.status)}
          </strong>
          <p className={styles.summary}>{brief.regulatory.summary}</p>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="brief-details">
        <h2 id="brief-details">Hunt details</h2>
        <div className={styles.detailGrid}>
          {brief.regulatory.season && (
            <div className={styles.detail}>
              <span className={styles.label}>Season snapshot</span>
              <p>
                {formatDate(brief.regulatory.season.opens, { month: "short", day: "numeric", year: "numeric" })}
                {" – "}
                {formatDate(brief.regulatory.season.closes, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
          {brief.legalTime && (
            <div className={styles.detail}>
              <span className={styles.label}>Legal-time information</span>
              <p>{brief.legalTime.summary}</p>
            </div>
          )}
          {brief.weatherSnapshot && (
            <div className={styles.detail}>
              <span className={styles.label}>
                {brief.weatherSnapshot.status === "available" ? "Weather when brief was created" : "Weather snapshot"}
              </span>
              <p>
                {brief.weatherSnapshot.status === "available"
                  ? brief.weatherSnapshot.summary
                  : brief.weatherSnapshot.reason}
              </p>
              {brief.weatherSnapshot.status === "available" && (
                <p className={styles.sourceMeta}>
                  {brief.weatherSnapshot.validFor
                    ? `Forecast for ${formatDate(brief.weatherSnapshot.validFor, { month: "short", day: "numeric", year: "numeric" })}. `
                    : ""}
                  Captured {formatDate(brief.weatherSnapshot.asOf, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {brief.assumptions.length > 0 && (
        <section className={styles.section} aria-labelledby="brief-assumptions">
          {/* Stated before the conditions, because everything below is only the
              answer to THIS hunt. A reader whose own answers differ is looking at
              someone else's result. */}
          <h2 id="brief-assumptions">This result assumed</h2>
          <ul className={styles.warningList}>
            {brief.assumptions.map((assumption) => (
              <li key={assumption.question}>
                {assumption.question} <strong>{assumption.answer}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.sourceMeta}>
            Supplied by the person who ran this Hunt. North Ground did not verify any
            licence, tag or residency, and a different answer may produce a different season.
          </p>
        </section>
      )}

      {brief.readiness && (
        <section className={styles.section} aria-labelledby="brief-readiness">
          <h2 id="brief-readiness">Ready to hunt</h2>
          {brief.readiness.coverage === "UNAVAILABLE" ? (
            <p className={styles.sourceMeta}>
              North Ground had no Ready to Hunt checklist for {brief.readiness.jurisdictionName} when this
              brief was created. Check the authority&apos;s own licence, hunter-orange and method rules.
            </p>
          ) : (
            <>
              <ul className={styles.readinessList}>
                {brief.readiness.authorizations.map((item) => (
                  <li key={item.name}>
                    <span className={styles.readinessStatus}>{AUTHORIZATION_STATUS_LABEL[item.status]}</span>
                    <span>
                      <strong>{item.name}</strong> · {item.authority}
                      {item.condition && <span className={styles.readinessNote}>{item.condition}</span>}
                      {item.fee && <span className={styles.readinessNote}>{item.fee}</span>}
                    </span>
                  </li>
                ))}
                {brief.readiness.orange && (
                  <li>
                    <span className={styles.readinessStatus}>{ORANGE_STATUS_LABEL[brief.readiness.orange.status]}</span>
                    <span>
                      <strong>Hunter orange</strong>
                      <span className={styles.readinessNote}>{brief.readiness.orange.summary}</span>
                    </span>
                  </li>
                )}
              </ul>
              {brief.readiness.legalMethods.length > 0 && (
                <p className={styles.sourceMeta}>Legal methods: {brief.readiness.legalMethods.join(" · ")}</p>
              )}
            </>
          )}
          <p className={styles.sourceMeta}>
            A snapshot of what this hunt needed when the brief was created, for the answers above. North Ground
            cannot check what anyone holds.
            {brief.readiness.officialInfoUrl && (
              <> <a href={brief.readiness.officialInfoUrl} rel="noopener noreferrer" target="_blank">Official licence information</a></>
            )}
          </p>
        </section>
      )}

      {brief.authorization && (
        <section className={styles.section} aria-labelledby="brief-authorization">
          {/* The hunt the answer is true under. Availability of the season, never
              a statement about what the person who shared it holds. */}
          <h2 id="brief-authorization">Licence and hunt</h2>
          <ul className={styles.warningList}>
            {brief.authorization.huntCodes.map((huntCode) => (
              <li key={huntCode.code}>
                {huntCode.authorityTerm} <strong>{huntCode.code}</strong> · {huntCode.allocationTerm}
                {huntCode.quota ? ` · ${huntCode.quota}` : ""}
              </li>
            ))}
            {brief.authorization.draws.map((draw) => <li key={draw}>{draw}</li>)}
          </ul>
          <p className={styles.sourceMeta}>{brief.authorization.statedAs}</p>
        </section>
      )}

      {brief.warnings.length > 0 && (
        <section className={styles.section} aria-labelledby="brief-warnings">
          <h2 id="brief-warnings">Important conditions and warnings</h2>
          <ul className={styles.warningList}>
            {brief.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}

      {brief.officialSources.length > 0 && (
        <section className={styles.section} aria-labelledby="brief-sources">
          <h2 id="brief-sources">Official sources</h2>
          <ul className={styles.sourceList}>
            {brief.officialSources.map((source) => (
              <li key={source.id ?? source.url}>
                <a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>
                <div className={styles.sourceMeta}>
                  {source.authority}
                  {source.effectiveDate ? ` · Effective ${source.effectiveDate}` : ""}
                  {source.verifiedAt
                    ? ` · Checked ${formatDate(source.verifiedAt, { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {brief.resourceReferences.length > 0 && (
        <section className={styles.section} aria-labelledby="brief-resources">
          <h2 id="brief-resources">Related North Ground information</h2>
          <ul className={styles.resourceList}>
            {brief.resourceReferences.map((resource) => (
              <li key={resource.id}>
                {resource.href ? <Link href={resource.href}>{resource.title}</Link> : resource.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.footer}>
        <p className={styles.timestamp}>
          Brief generated {formatDate(brief.createdAt, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.
          {brief.regulatory.verifiedAt
            ? ` Regulations were verified ${formatDate(brief.regulatory.verifiedAt, { month: "long", day: "numeric", year: "numeric" })}.`
            : ""}
        </p>
        <p className={styles.finePrint}>
          This is a snapshot of what North Ground reported when the brief was created. Rules, boundaries and conditions can change. Check the current Hunt result and official sources before hunting.
        </p>
        <Link className={styles.action} href={checkCurrentHuntPath(brief)}>
          Check current Hunt
        </Link>
      </footer>
    </article>
  );
}
