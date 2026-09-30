"use client";

import type { OpportunityCondition, ZoneOpportunity } from "../../../lib/hunt/exploration/opportunity";
import { isMaterial } from "../../../lib/hunt/exploration/condition-scope";
import { INTERFACE_LANGUAGE } from "../../../lib/hunt/translation";
import AuthorityText from "./AuthorityText";
import styles from "./Answer.module.css";

/**
 * What a `!` on the map meant, as the first thing the zone's card says.
 *
 * THE DEFECT THIS CLOSES. A zone wore a `!`, a hunter tapped the zone, and the
 * card said "Depends on your hunt" and a sentence — the conditions themselves
 * lived in a disclosure behind "Details", or nowhere. A marker that promises a
 * condition and a card that never names it is §41A's "naming a category of fact
 * and withholding its contents" at map scale.
 *
 * ONE ANSWER, THREE SURFACES. This reads the very `ZoneOpportunity` the map
 * drew the marker from — the same conditions, the same ids, the same
 * `material` flags — so the marker, its popover and this card cannot disagree
 * about why a zone is conditional. `data-condition-id` carries each id so a
 * browser test can hold them to it.
 *
 * Material conditions come first, under "Conditions apply", because a critical
 * blocker is never progressive disclosure. The standing requirements every
 * open zone of the jurisdiction shares follow, quieter, because they are real
 * but are not why THIS zone is marked.
 */
export default function ZoneConditions({ opportunity }: { opportunity: ZoneOpportunity | null | undefined }) {
  if (!opportunity?.hasCurrentLegalOpportunity || !opportunity.conditions.length) return null;
  const material = opportunity.conditions.filter(isMaterial);
  const standing = opportunity.conditions.filter((condition) => !isMaterial(condition));

  return (
    <div className={styles.zoneConditions} data-zone-conditions="">
      {material.length ? (
        <section className={`${styles.block} ${styles.conditions}`} aria-labelledby="zone-conditions-apply">
          <h3 className={styles.blockTitle} id="zone-conditions-apply">
            <span aria-hidden="true">! </span>Conditions apply
          </h3>
          <ul className={styles.conditionList}>
            {material.map((condition) => <ConditionRow key={condition.id} condition={condition} />)}
          </ul>
        </section>
      ) : null}
      {standing.length ? (
        <section className={styles.block} aria-labelledby="zone-conditions-standing">
          <h3 className={styles.blockTitle} id="zone-conditions-standing">
            {material.length ? "Also required" : "Required"}
          </h3>
          <ul className={styles.conditionList}>
            {standing.map((condition) => <ConditionRow key={condition.id} condition={condition} />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ConditionRow({ condition }: { condition: OpportunityCondition }) {
  return (
    <li data-condition-id={condition.id} data-material={isMaterial(condition) ? "true" : "false"}>
      {/* The reading in the interface language where one is held, the
          original one control away; an authority's words are quoted. */}
      <AuthorityText into={INTERFACE_LANGUAGE} text={{ text: condition.text, lang: condition.lang, owner: condition.owner }} />
      {condition.sourceSection || condition.source ? (
        <span className={styles.conditionWhere}>
          {condition.sourceSection}
          {condition.source ? (
            <>
              {condition.sourceSection ? " · " : null}
              <a href={condition.source.url} target="_blank" rel="noopener noreferrer">
                {condition.source.publisher} <span aria-hidden="true">↗</span>
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}
