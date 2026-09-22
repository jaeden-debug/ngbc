import type { IntelligenceCoverage } from "./applicability.ts";
import type { SpatialPrecision, SpatialResolution } from "./spatial-precision.ts";
import { permitsVisualisationAt } from "./spatial-precision.ts";
import { licencePermitsServing, licencePermitsStoredCopy, type SourceLicence } from "../source-licence.ts";
import type { EvidenceRecord } from "./types.ts";

/**
 * What may actually be published, after the evidence is sound.
 *
 * Two separate gates, both of which can close over evidence that is perfectly
 * good:
 *
 *   SENSITIVITY — precise locations of some animals are dangerous to those
 *   animals. A den, a lek, a calving ground, a hibernaculum or a nest site
 *   published at a point is a map to it. Publishers say so in their own terms
 *   and North Ground honours it by coarsening or withholding, never by
 *   publishing and hoping.
 *   LICENCE — read from `source-licence.ts`, which is the one place that
 *   decides what a publisher permits. This module asks it; it does not
 *   reimplement it.
 *
 * Both refusals are VISIBLE. A suppressed layer says it is restricted, because
 * silently removing it would read as "no animals here" — the same false claim
 * from the opposite direction.
 */

export type SensitivityPolicy =
  /** Publish at the resolution the evidence supports. */
  | "NONE"
  /** Publish only after coarsening to the stated precision. */
  | "GENERALISE"
  /** Do not publish location at all; the species may still be named as present in the jurisdiction. */
  | "SUPPRESS";

export interface SensitivityRule {
  /** Canonical species id, or a class of evidence the rule covers. */
  speciesId: string;
  policy: SensitivityPolicy;
  /** The coarsest the evidence may be shown at, for GENERALISE. */
  generaliseTo?: SpatialPrecision;
  /** Who requires this and in what words, so it can be re-checked. */
  statedBy: string;
  reason: string;
}

/**
 * Sensitivity is source-declared, not guessed.
 *
 * Empty at present, deliberately: North Ground publishes no point-level
 * wildlife observations yet, so there is nothing to suppress. The contract
 * exists first so that the first observation feature cannot be built without
 * passing through it — which is the only order in which this kind of protection
 * actually works.
 */
export const SENSITIVITY_RULES: readonly SensitivityRule[] = [];

export function sensitivityFor(speciesId: string): SensitivityRule | null {
  return SENSITIVITY_RULES.find((rule) => rule.speciesId === speciesId) ?? null;
}

export type PublicationVerdict =
  | { publish: true; resolution: SpatialResolution; generalised: boolean; note?: string }
  | { publish: false; coverage: Extract<IntelligenceCoverage, "RESTRICTED">; reason: string; statedBy?: string };

/**
 * Whether one record may be published at an intended resolution.
 *
 * Order matters: licence first, because a licence refusal is absolute and
 * coarsening cannot cure it; then sensitivity, which can be cured by
 * coarsening; then the governing resolution rule, which can not.
 */
export function mayPublish(
  record: Pick<EvidenceRecord, "speciesId">,
  licence: SourceLicence,
  evidence: SpatialResolution,
  intended: SpatialResolution,
): PublicationVerdict {
  if (!licencePermitsServing(licence)) {
    return {
      publish: false,
      coverage: "RESTRICTED",
      reason: `The publisher's terms do not permit North Ground to serve this: ${licence.statedAs}`,
      statedBy: licence.url,
    };
  }

  const sensitivity = sensitivityFor(record.speciesId);
  if (sensitivity?.policy === "SUPPRESS") {
    return { publish: false, coverage: "RESTRICTED", reason: sensitivity.reason, statedBy: sensitivity.statedBy };
  }

  let target = intended;
  let generalised = false;
  let note: string | undefined;
  if (sensitivity?.policy === "GENERALISE" && sensitivity.generaliseTo) {
    const required: SpatialResolution = { precision: sensitivity.generaliseTo };
    // Coarsen when the intended drawing is finer than the protection allows.
    if (!permitsVisualisationAt(required, intended).permitted) {
      target = required;
      generalised = true;
      note = `Shown coarsened to ${sensitivity.generaliseTo}. ${sensitivity.reason}`;
    }
  }

  const verdict = permitsVisualisationAt(evidence, target);
  if (!verdict.permitted) {
    return { publish: false, coverage: "RESTRICTED", reason: verdict.reason };
  }
  return { publish: true, resolution: target, generalised, ...(note ? { note } : {}) };
}

/**
 * A North Ground habitat model, and what makes one publishable.
 *
 * A habitat model is the only T4 evidence North Ground produces itself, so it
 * is the one place the platform could fabricate at scale without noticing. The
 * defence is reproducibility: every input named with the exact version that was
 * used, every weight written down, the rule stated, and the output resolution
 * fixed at the coarsest input. Anyone — including a reviewer two years from now
 * — must be able to re-run it and get the same surface.
 *
 * A model that cannot be re-run is an opinion with a colour ramp.
 */
export interface HabitatModelInput {
  datasetId: string;
  /** The exact bytes used, so a silently updated source is a different model. */
  sourceHash: `sha256:${string}`;
  resolution: SpatialResolution;
  /** Its share of the result. The weights must sum to 1. */
  weight: number;
  statedAs: string;
}

export interface HabitatModel {
  id: string;
  /** Immutable. Changing any input, weight or rule makes a new version. */
  version: string;
  speciesId: string;
  jurisdictionId: string;
  inputs: readonly HabitatModelInput[];
  /** How the inputs combine, in words a reviewer can check the code against. */
  rule: string;
  publishedAt: string;
  /** What the model may be used to say. Never presence, never abundance. */
  statedAs: string;
}

export interface ModelVerdict {
  reproducible: boolean;
  /** The coarsest input: the model can be no finer than its weakest ingredient. */
  outputResolution: SpatialResolution | null;
  problems: string[];
}

export function habitatModelIsReproducible(model: HabitatModel): ModelVerdict {
  const problems: string[] = [];
  if (!model.inputs.length) problems.push("A model with no declared inputs cannot be re-run.");
  for (const input of model.inputs) {
    if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceHash)) problems.push(`${input.datasetId} has no usable source hash, so the exact data used cannot be identified.`);
    if (!(input.weight > 0)) problems.push(`${input.datasetId} carries no positive weight.`);
  }
  const total = model.inputs.reduce((sum, input) => sum + input.weight, 0);
  if (model.inputs.length && Math.abs(total - 1) > 1e-9) problems.push(`Weights sum to ${total}, not 1, so the result is not the combination it claims.`);
  if (!model.rule.trim()) problems.push("The combining rule is not stated.");

  // The governing rule again, inside the model: the output cannot be finer than
  // its coarsest input, whatever resolution the rendering would prefer.
  let outputResolution: SpatialResolution | null = model.inputs[0]?.resolution ?? null;
  for (const { resolution, datasetId } of model.inputs.slice(1)) {
    if (!outputResolution) break;
    if (permitsVisualisationAt(resolution, outputResolution).permitted) continue;
    if (permitsVisualisationAt(outputResolution, resolution).permitted) { outputResolution = resolution; continue; }
    problems.push(`${datasetId} is at a resolution that does not nest with the other inputs, so no honest output resolution exists.`);
    outputResolution = null;
  }

  return { reproducible: problems.length === 0 && outputResolution !== null, outputResolution, problems };
}

/**
 * Whether a model's inputs may be kept at all.
 *
 * Separate from serving: a licence can permit a live read and forbid a stored
 * copy, and a model needs the stored copy to stay reproducible. One that cannot
 * keep its inputs cannot promise to be re-runnable, and says so.
 */
export function modelInputsMayBeStored(licences: readonly SourceLicence[]): { stored: boolean; blockedBy: string[] } {
  const blockedBy = licences.filter((licence) => !licencePermitsStoredCopy(licence)).map((licence) => licence.statedAs);
  return { stored: blockedBy.length === 0, blockedBy };
}
