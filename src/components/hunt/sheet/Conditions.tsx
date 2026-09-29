"use client";

import { conditionsBySource, type RegulatoryCondition } from "../../../lib/hunt/regulatory/condition";
import type { HuntEvaluation } from "../../../lib/hunt/types";
import AuthorityText from "./AuthorityText";
import { INTERFACE_LANGUAGE } from "../../../lib/hunt/translation";
import styles from "./Answer.module.css";

/**
 * What "with conditions" actually means, directly under the status.
 *
 * THE PROBLEM THIS SOLVES. The most common answer North Ground gives is "in
 * season, with conditions", and until now a hunter reading it had to open
 * "Details" and scroll past the answer's prose to find out which conditions.
 * Naming a category of fact and withholding its contents is the one thing a
 * status word must never do — and §41A says outright that a critical blocker is
 * never progressive disclosure. So this sits in the scan, never in a
 * `<Disclosure>`.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING. That is the other half, and the
 * more important half: where the engine enumerates no condition the block is
 * absent AND the status word drops "with conditions" (see `HuntAnswer`). A
 * warning that fires everywhere is a warning nobody reads, and then it is
 * missing when it is specific.
 *
 * Provenance is grouped, not repeated. Several conditions from one instrument
 * share one source line rather than dragging a citation each (§16). The source
 * is rendered from the evaluation's own `sources`, so a condition can never
 * cite a document the answer does not list.
 */
export default function Conditions({ conditions, sources }: {
  conditions: readonly RegulatoryCondition[];
  sources: HuntEvaluation["sources"];
}) {
  if (!conditions.length) return null;
  const byId = new Map(sources.map((source) => [source.id, source]));
  const groups = conditionsBySource(conditions);

  return (
    <section className={`${styles.block} ${styles.conditions}`} aria-labelledby="hunt-conditions">
      <h3 className={styles.blockTitle} id="hunt-conditions">Conditions</h3>
      {groups.map((group) => {
        const source = byId.get(group.sourceId);
        return (
          <ul className={styles.conditionList} key={group.sourceId}>
            {group.conditions.map((condition) => (
              /*
               * An authority's words are quoted and language-tagged; North
               * Ground's render plainly. The renderer never decides which —
               * `owner` is recorded by whoever wrote the line, because
               * attributing our own caution to a ministry is the quiet mirror
               * of asserting a prohibition nobody legislated.
               */
              <li key={condition.id}>
                {/* The reading, with the original one control away. A hunter
                    must not need French to learn what a condition is. */}
                <AuthorityText into={INTERFACE_LANGUAGE} text={{ text: condition.text, lang: condition.lang, owner: condition.owner }} />
                <span className={styles.conditionWhere}>
                  {condition.sourceSection}
                  {source ? (
                    <>
                      {" · "}
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.publisher} <span aria-hidden="true">↗</span>
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </section>
  );
}
