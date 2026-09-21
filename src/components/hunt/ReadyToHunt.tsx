"use client";

import { CHANNEL_LABELS, METHOD_LABELS, formatPrice } from "../../lib/hunt/readiness/format";
import type {
  AuthorizationChecklistItem, Provenance, ReadinessResult, Recommendation,
} from "../../lib/hunt/readiness/types";
import type { SpeciesPrimaryMedia } from "../../lib/species-media/types";
import SpeciesPrimaryImage from "../species/SpeciesPrimaryImage";
import VendorSearch from "./VendorSearch";
import styles from "./ReadyToHunt.module.css";

/**
 * Ready to Hunt: the bare essentials before someone can go.
 *
 * Three kinds of line, never blended. REQUIRED and ALLOWED are the law, each
 * with its source one tap away. RECOMMENDED is North Ground's practical advice,
 * labelled as such, and never changes what the law says. Status is always a
 * word, so nothing depends on colour.
 */

const AUTHORIZATION_WORD = { REQUIRED: "Required", CONDITIONAL: "Depends", UNKNOWN: "Unknown" } as const;
const ORANGE_WORD = { REQUIRED: "Required", NOT_REQUIRED: "Not required", CONDITIONAL: "Depends", UNKNOWN: "Unknown" } as const;

function Sources({ provenance }: { provenance: Provenance[] }) {
  if (!provenance.length) return null;
  return (
    <details className={styles.sources}>
      <summary>Source</summary>
      <ul>
        {/* One source can be cited for several passages, so the passage is part of the key. */}
        {provenance.map((source, index) => (
          <li key={`${source.sourceId}-${source.citation}-${index}`}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.citation}</a>
            {source.quote ? <q>{source.quote}</q> : null}
            <span className={styles.meta}>Read {source.retrievedAt}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Fee({ item, onChooseResidency }: { item: AuthorizationChecklistItem; onChooseResidency?: (value: "RESIDENT" | "NON_RESIDENT") => void }) {
  const infoUrl = item.purchase?.infoUrl;
  if (item.price.kind === "VERIFIED") {
    return (
      <ul className={styles.fees}>
        {item.price.prices.map((price) => (
          <li key={price.label}><span>{price.label}</span> <strong className="ng-numeric">{formatPrice(price)}</strong></li>
        ))}
      </ul>
    );
  }
  if (item.price.kind === "NEEDS_CATEGORY") {
    return (
      <div className={styles.category} role="group" aria-label={`Fee for ${item.officialName} depends on residency`}>
        <span className={styles.meta}>The fee depends on residency. Are you a resident?</span>
        {onChooseResidency ? (
          <span className={styles.choices}>
            <button type="button" className={styles.choice} onClick={() => onChooseResidency("RESIDENT")}>Resident</button>
            <button type="button" className={styles.choice} onClick={() => onChooseResidency("NON_RESIDENT")}>Non-resident</button>
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <p className={styles.meta}>
      {infoUrl ? <a href={infoUrl} target="_blank" rel="noopener noreferrer">Check current official fee</a> : "Check current official fee"}
      {" "}— {item.price.reason}
    </p>
  );
}

function Purchase({ item }: { item: AuthorizationChecklistItem }) {
  const purchase = item.purchase;
  if (!purchase) return null;
  return (
    <p className={styles.meta}>
      {purchase.channels.map((channel) => CHANNEL_LABELS[channel]).join(" · ")}
      {purchase.onlineUrl ? <> · <a href={purchase.onlineUrl} target="_blank" rel="noopener noreferrer">Buy online</a></> : null}
      {purchase.phone ? <> · <a href={`tel:${purchase.phone.replace(/[^0-9+]/g, "")}`}>{purchase.phone}</a></> : null}
      {" · "}<a href={purchase.infoUrl} target="_blank" rel="noopener noreferrer">Official details</a>
      {purchase.note ? <span className={styles.block}>{purchase.note}</span> : null}
    </p>
  );
}

function Advice({ items }: { items: Recommendation[] }) {
  if (!items.length) return null;
  return (
    <div className={styles.advice}>
      <p className={styles.adviceLabel}><span className={styles.word}>Recommended</span> North Ground&apos;s practical advice — not a legal requirement</p>
      <ul>
        {items.map((item) => (
          <li key={item.text}>
            {item.text}
            {item.withinLegal ? <span className={styles.meta}>Checked against: {item.withinLegal}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const RESIDENCY_WORD = { RESIDENT: "Resident", NON_RESIDENT: "Non-resident" } as const;

export default function ReadyToHunt({
  readiness, speciesMedia, speciesName, residency, onChooseResidency,
}: {
  readiness: ReadinessResult;
  speciesMedia: SpeciesPrimaryMedia | null;
  speciesName: string;
  /** The residency this result was checked for, if the hunter gave one. */
  residency?: string;
  /** Records residency through the same answer the regulation reads, then re-checks the hunt. */
  onChooseResidency?: (value: "RESIDENT" | "NON_RESIDENT") => void;
}) {
  if (readiness.coverage === "UNAVAILABLE") {
    return (
      <section className={`${styles.ready} ng-glass-panel`} aria-labelledby="ready-heading">
        <div className={styles.readyIdentity}>{speciesMedia ? <SpeciesPrimaryImage media={speciesMedia} variant="avatar" className={styles.readySpeciesImage} /> : null}<h3 id="ready-heading" className={styles.heading}>Ready to hunt <span className="ng-visually-hidden">{speciesName}</span></h3></div>
        {readiness.limitations.map((line) => <p key={line} className={styles.note}>{line}</p>)}
        {readiness.officialInfoUrl ? (
          <p className={styles.note}><a href={readiness.officialInfoUrl} target="_blank" rel="noopener noreferrer">Official source for {readiness.jurisdictionName}</a></p>
        ) : null}
      </section>
    );
  }

  // Whether any fee shown was chosen by residency, so the category is stated beside it.
  const feesByResidency = readiness.authorizations.some((item) =>
    item.price.kind === "VERIFIED" && item.price.prices.some((price) => price.appliesTo.residency?.length));
  const inPerson = readiness.vendorSearch
    && readiness.authorizations.some((item) => item.purchase?.channels.includes("PHYSICAL_VENDOR"));

  return (
    <section className={`${styles.ready} ng-glass-panel`} aria-labelledby="ready-heading">
      <div className={styles.readyIdentity}>{speciesMedia ? <SpeciesPrimaryImage media={speciesMedia} variant="avatar" className={styles.readySpeciesImage} /> : null}<h3 id="ready-heading" className={styles.heading}>Ready to hunt <span className="ng-visually-hidden">{speciesName}</span></h3></div>
      <p className={styles.note}>What you need before you go, from {readiness.jurisdictionName}&apos;s rules for this hunt.</p>

      <h4 className={styles.subhead}>Licences and permits</h4>
      {feesByResidency && (residency === "RESIDENT" || residency === "NON_RESIDENT") ? (
        <p className={styles.meta}>
          Fees shown for: <strong>{RESIDENCY_WORD[residency]}</strong>
          {onChooseResidency ? (
            <>
              {" · "}
              <button
                type="button"
                className={styles.inlineButton}
                onClick={() => onChooseResidency(residency === "RESIDENT" ? "NON_RESIDENT" : "RESIDENT")}
              >
                Show {RESIDENCY_WORD[residency === "RESIDENT" ? "NON_RESIDENT" : "RESIDENT"].toLowerCase()} fees
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <ul className={styles.list}>
        {readiness.authorizations.map((item) => (
          <li key={item.id} className={styles.row} data-status={item.status}>
            <span className={styles.word}>{AUTHORIZATION_WORD[item.status]}</span>
            <div className={styles.body}>
              <p className={styles.name}>{item.officialName}</p>
              <p className={styles.meta}>{item.authority}</p>
              {item.conditionText ? <p className={styles.condition}>{item.conditionText}</p> : null}
              {item.prerequisites.length ? (
                <p className={styles.meta}>Needs first: {item.prerequisites.map((entry) => entry.officialName).join(", ")}</p>
              ) : null}
              {item.draw ? <p className={styles.meta}>Issued by draw{item.draw.note ? `: ${item.draw.note}` : "."}</p> : null}
              {item.note ? <p className={styles.meta}>{item.note}</p> : null}
              <Fee item={item} onChooseResidency={onChooseResidency} />
              <Purchase item={item} />
              <Sources provenance={item.provenance} />
            </div>
          </li>
        ))}
      </ul>

      {readiness.orange ? (
        <>
          <h4 className={styles.subhead}>Hunter orange</h4>
          <div className={styles.row} data-status={readiness.orange.status}>
            <span className={styles.word}>{ORANGE_WORD[readiness.orange.status]}</span>
            <div className={styles.body}>
              <p className={styles.name}>{readiness.orange.summary}</p>
              {readiness.orange.specification && readiness.orange.status !== "NOT_REQUIRED" ? (
                <p className={styles.condition}>{readiness.orange.specification}</p>
              ) : null}
              {readiness.orange.exceptions.length ? (
                <ul className={styles.plain}>{readiness.orange.exceptions.map((line) => <li key={line}>{line}</li>)}</ul>
              ) : null}
              <Sources provenance={readiness.orange.provenance} />
            </div>
          </div>
        </>
      ) : null}

      {readiness.methods ? (
        <>
          <h4 className={styles.subhead}>What you may hunt with</h4>
          <ul className={styles.list}>
            {readiness.methods.allowed.map((method) => (
              <li key={method.method} className={styles.row} data-status={method.status}>
                <span className={styles.word}>{method.status === "ALLOWED" ? "Allowed" : "Depends"}</span>
                <div className={styles.body}>
                  <p className={styles.name}>{METHOD_LABELS[method.method]}</p>
                  {method.restriction ? <p className={styles.condition}>{method.restriction}</p> : null}
                  <Sources provenance={method.provenance} />
                </div>
              </li>
            ))}
            {readiness.methods.notAllowed.length ? (
              <li className={styles.row} data-status="NOT_ALLOWED">
                <span className={styles.word}>Not allowed</span>
                <div className={styles.body}>
                  <p className={styles.name}>{readiness.methods.notAllowed.map((method) => METHOD_LABELS[method]).join(", ")}</p>
                </div>
              </li>
            ) : null}
          </ul>
          <Advice items={readiness.methods.recommended} />
        </>
      ) : null}

      {readiness.ammunition && (readiness.ammunition.required.length || readiness.ammunition.recommended.length) ? (
        <>
          <h4 className={styles.subhead}>Ammunition</h4>
          <ul className={styles.list}>
            {readiness.ammunition.required.map((rule) => (
              <li key={rule.summary} className={styles.row} data-status={rule.status}>
                <span className={styles.word}>{rule.status === "REQUIRED" ? "Required" : "Depends"}</span>
                <div className={styles.body}>
                  <p className={styles.name}>{rule.summary}</p>
                  <p className={styles.meta}>Applies to: {rule.appliesToMethods.map((method) => METHOD_LABELS[method]).join(", ")}</p>
                  <Sources provenance={rule.provenance} />
                </div>
              </li>
            ))}
          </ul>
          <Advice items={readiness.ammunition.recommended} />
        </>
      ) : null}

      {inPerson ? <VendorSearch directoryId={readiness.vendorSearch!.directoryId} attribution={readiness.vendorSearch!.attribution} /> : null}

      <ul className={styles.limits}>
        {readiness.limitations.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className={styles.meta}>
        <a href={readiness.officialInfoUrl} target="_blank" rel="noopener noreferrer">{readiness.jurisdictionName} licence information</a>
      </p>
    </section>
  );
}
