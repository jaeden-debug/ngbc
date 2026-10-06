import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeciesShotPlacementExplorer } from "../../components/species-authority/SpeciesVisualExplorers";
import { whiteTailedDeerAuthorityPage } from "./white-tailed-deer.ts";

/**
 * A SHOT VERDICT COMES FROM THE ASSESSMENT, NEVER FROM WHETHER AN IMAGE EXISTS.
 *
 * The explorer rendered `renditionId ? <image> : <PASS / No shot>`, so a
 * missing illustration WAS a shot-placement decision — announced to a screen
 * reader as "pass, do not shoot".
 *
 * It passed every gate because of a coincidence in the one page that existed:
 * on the white-tail page each PASS angle happens to carry no artwork and each
 * shootable angle carries some, so image-presence and the verdict agreed
 * exactly. Measured before the fix: Broadside PREFERRED/image, Modest
 * quartering-away CONDITIONAL/image, Frontal + Quartering toward + Rear-facing
 * all PASS/no image.
 *
 * They are different facts. Any species given shot guidance before artwork —
 * which universalization makes the normal case — would have had every angle,
 * including a PREFERRED one, tell a hunter not to shoot. §62 puts human safety
 * first and this is the direction that matters.
 */

const explorer = whiteTailedDeerAuthorityPage.visualExplorers.shotPlacement;
const renditions = Object.fromEntries(
  whiteTailedDeerAuthorityPage.visualAssets.flatMap((asset) => asset.renditions ?? []).map((r) => [r.id, r]),
);

function render(ex: typeof explorer) {
  return renderToStaticMarkup(
    <SpeciesShotPlacementExplorer explorer={ex} renditions={renditions} sourceNumbers={{}} />,
  );
}

test("the white-tail shot explorer still marks exactly its PASS angles, and no others", () => {
  /* A positive control: if the component stopped rendering verdicts at all,
     every assertion about absence below would pass for the wrong reason. */
  const html = render(explorer);
  const passAngles = explorer.items.filter((item) => item.assessment === "PASS");
  assert.ok(passAngles.length >= 3, `positive control: ${passAngles.length} PASS angles in the corpus`);
  for (const item of passAngles) {
    assert.ok(html.includes(`${item.label}: pass, do not shoot`), `${item.label} lost its PASS verdict`);
  }
  const shootable = explorer.items.filter((item) => item.assessment !== "PASS");
  assert.ok(shootable.length >= 2, `positive control: ${shootable.length} shootable angles`);
  for (const item of shootable) {
    assert.ok(!html.includes(`${item.label}: pass, do not shoot`), `${item.label} is ${item.assessment} but was marked PASS`);
  }
});

test("a shootable angle with no illustration is NOT rendered as a pass", () => {
  /*
   * THE DEFECT, REPRODUCED ON A REAL RECORD. The preferred angle keeps its
   * assessment and loses only its artwork — which is exactly the state every
   * species would be in before any illustration is made for it.
   */
  const preferred = explorer.items.find((item) => item.assessment === "PREFERRED");
  assert.ok(preferred, "positive control: the corpus has a PREFERRED angle");
  const stripped = {
    ...explorer,
    items: explorer.items.map((item) =>
      item.id === preferred!.id ? { ...item, renditionId: undefined, anatomyRenditionId: undefined } : item),
  };
  const html = render(stripped as typeof explorer);
  assert.ok(
    !html.includes(`${preferred!.label}: pass, do not shoot`),
    "a PREFERRED angle with no image was rendered as 'pass, do not shoot' — a missing image became a shot decision",
  );
  /* And the guidance itself survives: the angle is still on the page in words. */
  assert.ok(html.includes(preferred!.label), "the angle disappeared entirely instead of falling back to text");
  assert.ok(html.includes("PREFERRED"), "the real assessment is still shown");
});
