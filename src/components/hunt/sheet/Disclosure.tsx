import type { ReactNode } from "react";
import styles from "../HuntApp.module.css";

/**
 * One disclosure, for every Hunt surface that has more to say than a hunter
 * needs at a glance.
 *
 * It is a `<details>` rather than a button and a panel, deliberately:
 *
 * - its content is in the HTML the server sent, so a crawler, an answer engine
 *   and a reader without JavaScript all receive it — collapsed, never absent
 *   (§29);
 * - `<summary>` is the platform's disclosure control, so Enter, Space, focus
 *   order and the screen reader's expanded/collapsed announcement all work
 *   without being reimplemented;
 * - there is one set of blur, border and focus values for all of them, in
 *   `globals.css` and the module below, because components do not invent their
 *   own (§41A, glass design system).
 *
 * WHAT DOES NOT GO IN ONE: anything a hunter who missed it could be stopped,
 * fined or hurt by, today, here. A permit requirement, a closed area, a method
 * restriction and an orange requirement belong beside the status where they
 * cannot be missed. A disclosure is for explanation, provenance and the
 * limitations that are true everywhere — never for a blocker.
 */
export default function Disclosure({ title, note, count, children, id }: {
  title: string;
  /** A few words under the title: what is inside, not why it matters. */
  note?: string;
  /** Shown beside the title so the size of what is hidden is never a surprise. */
  count?: number;
  children: ReactNode;
  id?: string;
}) {
  return (
    <details className={styles.disclosure} id={id}>
      {/* The title stays a HEADING inside the summary: a disclosure is still a
          section of the page, and collapsing it must not remove it from the
          heading order a screen-reader user navigates by. */}
      <summary>
        <div className={styles.disclosureLabel}>
          <h3 className={styles.disclosureHeading}>{title}</h3>
          {note ? <span className={styles.disclosureNote}>{note}</span> : null}
        </div>
        {count !== undefined ? <span className={`${styles.disclosureCount} ng-numeric`}>{count}</span> : null}
      </summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}
