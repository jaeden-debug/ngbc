import Link from "next/link";
import type { ShareHuntBriefV1 } from "../../lib/hunt-share/model.ts";
import { checkCurrentHuntPath } from "../../lib/hunt-share/urls.ts";
import styles from "./HuntBrief.module.css";

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  );
}

function statusClass(status: ShareHuntBriefV1["regulatory"]["status"]): string {
  return {
    OPEN: styles.statusOpen,
    CLOSED: styles.statusClosed,
    CONDITIONAL: styles.statusConditional,
    UNKNOWN: styles.statusUnknown,
    CONFLICT: styles.statusConflict,
    NEEDS_VERIFICATION: styles.statusNeedsVerification,
  }[status];
}

function statusLabel(status: ShareHuntBriefV1["regulatory"]["status"]): string {
  return status === "NEEDS_VERIFICATION" ? "Needs verification" : status.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

export default function HuntBriefCard({ brief }: { brief: ShareHuntBriefV1 }) {
  const date = formatDate(brief.selectedDate, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className={styles.card}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>North Ground Hunt · Shared brief</p>
        <h1 className={styles.title}>{brief.species.displayName}</h1>
        <p className={styles.context}>
          <span>{brief.managementZone?.displayName ?? "Management zone unresolved"}</span>
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
