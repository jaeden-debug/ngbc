import nbAmericanBlackDuck from "../../../../content/intelligence/ca-nb-american-black-duck-ews-breeding.json" with { type: "json" };
import nbCanadaGoose from "../../../../content/intelligence/ca-nb-canada-goose-ews-breeding.json" with { type: "json" };
import nbCommonGoldeneye from "../../../../content/intelligence/ca-nb-common-goldeneye-ews-breeding.json" with { type: "json" };
import nbGreenWingedTeal from "../../../../content/intelligence/ca-nb-green-winged-teal-ews-breeding.json" with { type: "json" };
import nbMallard from "../../../../content/intelligence/ca-nb-mallard-ews-breeding.json" with { type: "json" };
import nbRingNeckedDuck from "../../../../content/intelligence/ca-nb-ring-necked-duck-ews-breeding.json" with { type: "json" };
import nbWoodDuck from "../../../../content/intelligence/ca-nb-wood-duck-ews-breeding.json" with { type: "json" };
import nlAmericanBlackDuck from "../../../../content/intelligence/ca-nl-american-black-duck-ews-breeding.json" with { type: "json" };
import nlCanadaGoose from "../../../../content/intelligence/ca-nl-canada-goose-ews-breeding.json" with { type: "json" };
import nlCommonGoldeneye from "../../../../content/intelligence/ca-nl-common-goldeneye-ews-breeding.json" with { type: "json" };
import nlGreenWingedTeal from "../../../../content/intelligence/ca-nl-green-winged-teal-ews-breeding.json" with { type: "json" };
import nlRingNeckedDuck from "../../../../content/intelligence/ca-nl-ring-necked-duck-ews-breeding.json" with { type: "json" };
import nsAmericanBlackDuck from "../../../../content/intelligence/ca-ns-american-black-duck-ews-breeding.json" with { type: "json" };
import nsCanadaGoose from "../../../../content/intelligence/ca-ns-canada-goose-ews-breeding.json" with { type: "json" };
import nsCommonGoldeneye from "../../../../content/intelligence/ca-ns-common-goldeneye-ews-breeding.json" with { type: "json" };
import nsGreenWingedTeal from "../../../../content/intelligence/ca-ns-green-winged-teal-ews-breeding.json" with { type: "json" };
import nsMallard from "../../../../content/intelligence/ca-ns-mallard-ews-breeding.json" with { type: "json" };
import nsRingNeckedDuck from "../../../../content/intelligence/ca-ns-ring-necked-duck-ews-breeding.json" with { type: "json" };
import nsWoodDuck from "../../../../content/intelligence/ca-ns-wood-duck-ews-breeding.json" with { type: "json" };
import onAmericanBlackDuck from "../../../../content/intelligence/ca-on-american-black-duck-ews-breeding.json" with { type: "json" };
import onBlueWingedTeal from "../../../../content/intelligence/ca-on-blue-winged-teal-ews-breeding.json" with { type: "json" };
import onBufflehead from "../../../../content/intelligence/ca-on-bufflehead-ews-breeding.json" with { type: "json" };
import onCanadaGoose from "../../../../content/intelligence/ca-on-canada-goose-ews-breeding.json" with { type: "json" };
import onCommonGoldeneye from "../../../../content/intelligence/ca-on-common-goldeneye-ews-breeding.json" with { type: "json" };
import onGreenWingedTeal from "../../../../content/intelligence/ca-on-green-winged-teal-ews-breeding.json" with { type: "json" };
import onMallard from "../../../../content/intelligence/ca-on-mallard-ews-breeding.json" with { type: "json" };
import onRingNeckedDuck from "../../../../content/intelligence/ca-on-ring-necked-duck-ews-breeding.json" with { type: "json" };
import onWoodDuck from "../../../../content/intelligence/ca-on-wood-duck-ews-breeding.json" with { type: "json" };
import qcAmericanBlackDuck from "../../../../content/intelligence/ca-qc-american-black-duck-ews-breeding.json" with { type: "json" };
import qcBufflehead from "../../../../content/intelligence/ca-qc-bufflehead-ews-breeding.json" with { type: "json" };
import qcCanadaGoose from "../../../../content/intelligence/ca-qc-canada-goose-ews-breeding.json" with { type: "json" };
import qcCommonGoldeneye from "../../../../content/intelligence/ca-qc-common-goldeneye-ews-breeding.json" with { type: "json" };
import qcGreenWingedTeal from "../../../../content/intelligence/ca-qc-green-winged-teal-ews-breeding.json" with { type: "json" };
import qcMallard from "../../../../content/intelligence/ca-qc-mallard-ews-breeding.json" with { type: "json" };
import qcRingNeckedDuck from "../../../../content/intelligence/ca-qc-ring-necked-duck-ews-breeding.json" with { type: "json" };
import qcWoodDuck from "../../../../content/intelligence/ca-qc-wood-duck-ews-breeding.json" with { type: "json" };
import type { IntelligenceBundle } from "./bundles.ts";

/**
 * The Eastern Waterfowl Survey bundles, one per species and jurisdiction.
 *
 * They are listed here rather than in `bundles.ts` for length alone — thirty-six
 * imports would bury the thirteen harvest datasets beside them. The rule is
 * unchanged: a bundle is servable because it is in this list and carries
 * evidence, and nothing else anywhere names a species or a jurisdiction.
 *
 * Built by `scripts/build-ews-waterfowl-evidence.mjs`, which is also where the
 * refusals live: a species is here only where the survey recorded it on at
 * least half that jurisdiction's plots, and the pairs it refused are printed by
 * the builder rather than silently absent.
 */
export const EWS25_BUNDLES = [
  nbAmericanBlackDuck, nbCanadaGoose, nbCommonGoldeneye, nbGreenWingedTeal,
  nbMallard, nbRingNeckedDuck, nbWoodDuck, nlAmericanBlackDuck,
  nlCanadaGoose, nlCommonGoldeneye, nlGreenWingedTeal, nlRingNeckedDuck,
  nsAmericanBlackDuck, nsCanadaGoose, nsCommonGoldeneye, nsGreenWingedTeal,
  nsMallard, nsRingNeckedDuck, nsWoodDuck, onAmericanBlackDuck,
  onBlueWingedTeal, onBufflehead, onCanadaGoose, onCommonGoldeneye,
  onGreenWingedTeal, onMallard, onRingNeckedDuck, onWoodDuck,
  qcAmericanBlackDuck, qcBufflehead, qcCanadaGoose, qcCommonGoldeneye,
  qcGreenWingedTeal, qcMallard, qcRingNeckedDuck, qcWoodDuck,
] as unknown as IntelligenceBundle[];
