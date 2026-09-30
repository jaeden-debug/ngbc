import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classificationOf } from "../regulatory/condition-kinds.ts";
import { readingFor } from "../translation.ts";
import type { LimitationLang } from "../limitation.ts";
import { statedConditionIsMaterial } from "./condition-scope.ts";
import { conditionDigest } from "./species-layer.ts";
import type { ZoneSpeciesAnswer } from "./states.ts";

/**
 * A `!` always opens onto something a hunter can read.
 *
 * THE INVARIANT, IN BOTH DIRECTIONS (§41A):
 *
 *     !  on the map  ->  tap  ->  a condition exists AND is readable
 *     no material condition   ->  no !
 *
 * WHY THIS GATE EXISTS RATHER THAN A REVIEW. The marker and its popover ask
 * two DIFFERENT questions of the same condition, and nothing made them agree:
 *
 *   - `zoneHasConditions` -> `zoneWearsMarker` -> `isMaterial(condition)`
 *   - `conditionDigest`   -> `isMaterial(condition) && readingFor(...) is not
 *                            UNTRANSLATED`
 *
 * So a zone whose material conditions are ALL untranslated for the reader's
 * language wears a marker whose popover has nothing in it. That is the same
 * defect as the blank paragraph under "Where to look for the animal": the
 * refusal was right and the words were missing. A hunter taps a warning and
 * learns nothing, which is worse than no warning at all — they now believe
 * they have checked.
 *
 * Québec publishes in French and everything else here publishes in English, so
 * this is not hypothetical in either direction; a French-reading hunter meets
 * it across most of the country.
 *
 * The universe is read from the COMMITTED BUNDLES, the same selection
 * `condition-kinds.test.ts` makes, so a new condition cannot reach the map
 * without passing through here.
 */

const LANGUAGES: readonly LimitationLang[] = ["en-CA", "fr-CA"];

interface EmittedCondition {
  id: string;
  text: string;
  lang: LimitationLang;
  /** A row that names its own zones is ZONE-scoped whatever the table says. */
  namesItsZones: boolean;
  origin: string;
}

function bundleConditions(file: string, lang: LimitationLang): EmittedCondition[] {
  const bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8")) as {
    sources?: Array<{ conditions?: Array<{ id: string; text?: string; zoneIds?: string[] }> }>;
  };
  return (bundle.sources ?? []).flatMap((source) =>
    (source.conditions ?? []).map((condition) => ({
      id: condition.id,
      text: condition.text ?? "",
      lang,
      namesItsZones: Array.isArray(condition.zoneIds) && condition.zoneIds.length > 0,
      origin: file,
    })),
  );
}

function quebecConditions(): EmittedCondition[] {
  const bundle = JSON.parse(readFileSync(new URL("../../../../content/regulatory/ca-qc-2026.json", import.meta.url), "utf8")) as {
    statements: Array<{ id: string; text?: string; scope: string; designations?: string[] }>;
  };
  /* The same selection `quebec.ts` makes: only rule- and designation-scoped
     statements become conditions. The ministry publishes in French. */
  return bundle.statements
    .filter((statement) => statement.scope === "rule" || statement.scope === "designations")
    .map((statement) => ({
      id: statement.id,
      text: statement.text ?? "",
      lang: "fr-CA" as const,
      namesItsZones: Array.isArray(statement.designations) && statement.designations.length > 0,
      origin: "ca-qc-2026.json",
    }));
}

const EMITTED: EmittedCondition[] = [
  ...["ca-ab-2026.json", "ca-mb-2026.json", "ca-on-major-game-2026.json", "us-id-pronghorn-2026.json", "us-mt-upland-2026.json", "ca-bc-2026.json", "ca-federal-2026.json"]
    .flatMap((file) => bundleConditions(file, "en-CA")),
  ...quebecConditions(),
];

/** Exactly the predicate the map reads, so the gate cannot drift from it. */
function wouldEarnMarker(condition: EmittedCondition): boolean {
  const { kind, scope } = classificationOf(condition.id, condition.namesItsZones);
  return statedConditionIsMaterial(kind, scope);
}

/** Exactly what the popover would be able to show, per language. */
function readableIn(condition: EmittedCondition, lang: LimitationLang): boolean {
  const reading = readingFor({ text: condition.text, lang: condition.lang, owner: "AUTHORITY" }, lang);
  if (reading.kind === "UNTRANSLATED") return false;
  return Boolean(reading.show?.text?.trim());
}

test("the bundles really do emit conditions, in both languages", () => {
  /* A positive control. Every assertion below is of the form "nothing is
     broken", and an empty universe satisfies all of them — so an ingest that
     silently stopped emitting conditions would turn this whole file green. */
  assert.ok(EMITTED.length > 20, `expected a real universe of conditions, found ${EMITTED.length}`);
  assert.ok(EMITTED.some((c) => c.lang === "fr-CA"), "the French-publishing jurisdiction must be in the universe");
  assert.ok(EMITTED.some((c) => c.lang === "en-CA"), "and the English-publishing ones");
  assert.ok(EMITTED.some(wouldEarnMarker), "and at least one condition must actually earn a marker");
});

test("every condition that earns a `!` has text a reader can reach", () => {
  /*
   * THE FIRST HALF OF THE INVARIANT. A marker is a promise that tapping it
   * says something. This is the only thing standing between that promise and a
   * popover with nothing in it.
   */
  const empty = EMITTED.filter((c) => wouldEarnMarker(c) && !c.text.trim());
  assert.deepEqual(empty.map((c) => `${c.origin}:${c.id}`), [], "a condition with no text at all cannot justify a marker");
});

test("tapping a `!` never opens onto nothing, in any language", () => {
  /*
   * THE BLOCKING INVARIANT, asserted through the FUNCTION THE POPOVER CALLS
   * rather than through a restatement of its rule. A test that re-implemented
   * the filter would agree with itself while the popover did something else —
   * which is exactly how the marker and the digest came to disagree.
   *
   * For every condition that earns a marker, the digest must yield at least one
   * line the popover can render. Where no reading exists the authority's own
   * text is shown, labelled (§41A), rather than the line being dropped.
   */
  const marking = EMITTED.filter(wouldEarnMarker);
  assert.ok(marking.length > 0, "positive control: some condition must earn a marker");

  const empty: string[] = [];
  for (const lang of LANGUAGES) {
    for (const condition of marking) {
      const answer = {
        opportunity: {
          hasCurrentLegalOpportunity: true,
          hasMaterialConditions: true,
          conditions: [{
            id: condition.id,
            kind: "STATED_CONDITION" as const,
            text: condition.text,
            lang: condition.lang,
            owner: "AUTHORITY" as const,
            material: true,
          }],
        },
      } as unknown as ZoneSpeciesAnswer;
      const { shown } = conditionDigest(answer, lang);
      if (!shown.length || !shown.some((line) => line.text.trim())) {
        empty.push(`${lang} <- ${condition.lang}  ${condition.origin}:${condition.id}`);
      }
    }
  }
  assert.deepEqual(empty, [], `these markers would open onto an empty popover:\n  ${empty.join("\n  ")}`);
});

/**
 * How many marker-earning conditions have no reading in each interface
 * language. Pinned, so the debt cannot grow quietly and closing it is a
 * deliberate edit rather than a silent drift.
 *
 * en-CA is 0 because every French condition that earns a marker already has a
 * stored English reading. fr-CA is 22 because the English-publishing bundles
 * have no French ones. Nothing is broken for a hunter today —
 * `INTERFACE_LANGUAGE` is fixed to en-CA — and the popover now falls back to
 * the authority's own words, so the day French ships these read as the
 * authority wrote them rather than as an empty panel. They are still a real
 * gap in §47's bilingual promise, owned by the translation lane.
 */
const UNTRANSLATED_MARKERS: Record<string, number> = { "en-CA": 0, "fr-CA": 22 };

test("the translation debt behind the markers is exactly what we think it is", () => {
  for (const lang of LANGUAGES) {
    const missing = EMITTED.filter((c) => wouldEarnMarker(c) && !readableIn(c, lang));
    assert.equal(
      missing.length,
      UNTRANSLATED_MARKERS[lang],
      `${lang}: ${missing.length} marker-earning conditions have no reading, expected ${UNTRANSLATED_MARKERS[lang]}.\n  `
        + missing.map((c) => `${c.origin}:${c.id}`).join("\n  "),
    );
  }
});
