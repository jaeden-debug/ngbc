"use client";

import { useState } from "react";
import { languageName, readingFor, type LanguagedText } from "../../../lib/hunt/translation";
import { quotedAuthority } from "../../../lib/hunt/provenance";
import styles from "./Answer.module.css";

/**
 * A line of regulatory text, readable by someone who does not have the language
 * the authority published it in.
 *
 * The default is the reading in the interface's language, labelled as a reading
 * and naming the language it came from; one control shows the authoritative
 * original and one returns. The original is never replaced, never re-tagged and
 * never loses its citation — `translation.ts` holds the model and the reasons.
 *
 * WHAT THIS COMPONENT DOES NOT DO. It does not detect a language, choose a
 * translation, or decide anything legal. It is handed a record that already
 * knows its own language and asks `readingFor` what exists. A renderer that
 * guessed would reintroduce the exact defect this replaces: a defaulted `lang`
 * once labelled « Territoires où toute activité de chasse est interdite. » as
 * English, and nothing on screen showed it.
 *
 * Quotation marks are decided by AUTHORSHIP, never by language. An authority's
 * words are quoted whichever language they are in; North Ground's reading of
 * them is not, because it is not a quotation of anybody.
 */
export default function AuthorityText({
  text,
  /** The authority's OWN text in another language, where the record holds one. */
  authorityAlso,
  /**
   * The language the interface is in. Passed, never inferred from the text —
   * and REQUIRED, because this component's own note above condemns a defaulted
   * lang and it carried one.
   *
   * Benign only while the interface is English-only: the default answers in
   * English whatever the reader asked for, so the moment a locale selector
   * arrives it is silently wrong, which is exactly when nobody is looking at
   * it. `INTERFACE_LANGUAGE` is the one declared place, so every call site
   * shows which language it chose.
   */
  into,
}: {
  text: LanguagedText;
  authorityAlso?: LanguagedText;
  into: LanguagedText["lang"];
}) {
  const reading = readingFor(text, into, authorityAlso);
  const [showingOriginal, setShowingOriginal] = useState(false);

  if (reading.kind === "ORIGINAL") {
    return (
      <span lang={reading.show.lang}>
        {reading.show.owner === "AUTHORITY" ? quotedAuthority(reading.show.text) : reading.show.text}
      </span>
    );
  }

  if (reading.kind === "UNTRANSLATED") {
    /* No reading exists. The original STAYS — hiding an authority's rule
       because we cannot read it to you is worse than showing it — and the
       interface says plainly what it is and that no reading is held. */
    return (
      <span className={styles.translated}>
        <span lang={reading.original.lang}>
          {reading.original.owner === "AUTHORITY" ? quotedAuthority(reading.original.text) : reading.original.text}
        </span>
        <span className={styles.translatedNote}>
          {reading.original.owner === "AUTHORITY" ? "The authority published this in " : "In "}
          {languageName(reading.original.lang)}. North Ground holds no {languageName(into)} reading of it yet.
        </span>
      </span>
    );
  }

  const authoritysOwn = reading.kind === "AUTHORITY_OTHER_LANGUAGE";
  const shown = showingOriginal ? reading.original : reading.show;

  return (
    <span className={styles.translated}>
      <span lang={shown.lang}>
        {/* AUTHORSHIP decides the marks. A North Ground reading is not a
            quotation of anyone, so it never wears them — which is also how a
            reader tells the two apart at a glance. */}
        {shown.owner === "AUTHORITY" ? quotedAuthority(shown.text) : shown.text}
      </span>
      <span className={styles.translatedNote}>
        {showingOriginal
          ? `The authority's own words, in ${languageName(reading.original.lang)}.`
          : authoritysOwn
            ? `The authority's own ${languageName(into)} text.`
            : `Translated by North Ground from ${languageName(reading.original.lang)}${
                reading.show.kind === "TRANSLATION" && reading.show.provenance === "NORTH_GROUND_GENERATED"
                  ? " — not yet reviewed"
                  : ""
              }.`}
        {" "}
        <button
          type="button"
          className={styles.translatedToggle}
          aria-pressed={showingOriginal}
          onClick={() => setShowingOriginal((was) => !was)}
        >
          {showingOriginal ? `Show the ${languageName(into)}` : `Show the original ${languageName(reading.original.lang)}`}
        </button>
      </span>
    </span>
  );
}
