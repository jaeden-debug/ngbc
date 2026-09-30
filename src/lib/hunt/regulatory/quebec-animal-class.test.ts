import assert from "node:assert/strict";
import test from "node:test";
import bundle from "../../../../content/regulatory/ca-qc-2026.json" with { type: "json" };
import { satisfies, type PhysicalCriterion } from "./physical-criterion.ts";

/**
 * Québec's antler boundary, tested at the evaluator rather than in the interface.
 *
 * The defect: the 7 cm lived only inside a French display string, so a hunter
 * told "antlerless is open" had no way to learn that a buck with short antlers
 * qualifies — and the classes meet exactly at 7 cm, so the boundary decides
 * whether the animal in front of them is legal.
 */

const classes = (bundle as unknown as {
  legalAnimalClasses: Record<string, Array<{
    id: string; statedAs: string; statedLanguage: string; negates?: string;
    criterion?: PhysicalCriterion; criterionStatus?: string; criterionBlocker?: string;
  }>>;
}).legalAnimalClasses;

const deer = classes["species:white-tailed-deer"];
const antlered = deer.find((entry) => entry.id.endsWith("deer-antlered"))!;

test("the boundary is at exactly 7 cm, and 7.0 is antlered", () => {
  const criterion = antlered.criterion!;
  assert.equal(satisfies(criterion, { value: 6.9, unit: "cm" }), false);
  assert.equal(satisfies(criterion, { value: 7.0, unit: "cm" }), true, "« 7 cm ou plus » includes 7.0");
  assert.equal(satisfies(criterion, { value: 7.1, unit: "cm" }), true);
  assert.equal(criterion.comparator, "AT_LEAST", "inclusive; Alberta's EXCEEDING is a different law");
});

test("antlerless is the negation, so the two classes cannot meet anywhere else", () => {
  const antlerless = deer.find((entry) => entry.id.endsWith("deer-antlerless"))!;
  assert.equal(antlerless.negates, antlered.id);
  assert.equal(antlerless.criterion, undefined, "a second threshold could drift from the first");
});

test("antlerless is NOT female, and the ministry's own wording says so", () => {
  const antlerless = deer.find((entry) => entry.id.endsWith("deer-antlerless"))!;
  assert.match(antlerless.statedAs, /femelle ou mâle avec bois de moins de 7 cm/);
  assert.equal(antlerless.statedLanguage, "fr", "the authority's words keep their language (§41A)");
  /* A male with antlers under 7 cm is antlerless. Anything rendering this class
     as "female" is wrong before it ships. */
  assert.equal(satisfies(antlered.criterion!, { value: 5, unit: "cm" }), false);
});

test("the aggregation is UNSTATED, because Québec does not state it", () => {
  /* Ontario says "at least 1 antler" and earns ANY_SIDE. Québec writes « dont
     les bois mesurent 7 cm ou plus » and says neither one antler nor both;
     guessing between them changes which animals are legal. */
  assert.equal(antlered.criterion!.aggregation, "UNSTATED");
});

test("the RTLB class carries no invented threshold", () => {
  /*
   * Eight deer rules reference « norme RTLB ». The ministry's page describes an
   * RTLB as "basée le plus fréquemment sur le nombre de pointes" — a statement
   * about RTLBs in general, not this one — and links an experiment that ended
   * in spring 2022. A point count taken from "le plus fréquemment" would be an
   * invented legal test on the fact a hunter needs at the moment of the shot.
   */
  const rtlb = deer.find((entry) => entry.id.endsWith("deer-antlered-rtlb"))!;
  assert.equal(rtlb.criterion, undefined);
  assert.equal(rtlb.criterionStatus, "UNRESOLVED");
  assert.ok((rtlb.criterionBlocker?.length ?? 0) > 80, "an unresolved criterion names its blocker");
});

test("moose carries its own 10 cm, and the turkey class carries no measure at all", () => {
  const moose = classes["species:moose"].find((entry) => entry.id.endsWith("moose-antlered"))!;
  assert.deepEqual(moose.criterion!.published, [{ value: 10, unit: "cm" }]);
  assert.equal(satisfies(moose.criterion!, { value: 10, unit: "cm" }), true);
  assert.equal(satisfies(moose.criterion!, { value: 9.9, unit: "cm" }), false);

  /* A beard is present or it is not: no measure, no comparator, nothing to
     aggregate. Forcing it into a length model would be rounding the source into
     the nearest field, which §41A forbids. */
  const turkey = classes["species:wild-turkey"].find((entry) => entry.id.endsWith("turkey-bearded"))!;
  assert.equal(turkey.criterion, undefined);
  assert.match(turkey.statedAs, /porteur d'une barbe/);
});
