import type {
  AnimalCharacteristicIntent,
  BiologicalAgeClass,
  BiologicalSex,
  CanonicalId,
  RegulatoryAnimalClassDimension,
} from "../content-contract/index.ts";

export type HuntActivity = "HUNTING" | "TRAPPING";

export interface AnimalCharacteristics {
  biologicalSex?: BiologicalSex;
  biologicalAgeClass?: BiologicalAgeClass;
  regulatoryClasses?: Array<{
    dimension: RegulatoryAnimalClassDimension;
    value: string;
  }>;
}

export interface AnimalSelection {
  speciesId: CanonicalId<"species">;
  activity: HuntActivity;
  characteristics: AnimalCharacteristics;
}

export interface RegulatoryInputOption {
  value: string;
  label: string;
}

export interface RegulatoryNeedsInput {
  status: "NEEDS_INPUT";
  requiredDimension:
    | "BIOLOGICAL_SEX"
    | "BIOLOGICAL_AGE_CLASS"
    | RegulatoryAnimalClassDimension;
  prompt: string;
  options: RegulatoryInputOption[];
  sourceDefinitionRequired: boolean;
}

export function characteristicsFromIntent(intent: AnimalCharacteristicIntent | undefined): AnimalCharacteristics {
  if (!intent) return {};
  if (intent.kind === "BIOLOGICAL" && intent.dimension === "SEX") {
    return { biologicalSex: intent.value };
  }
  if (intent.kind === "BIOLOGICAL" && intent.dimension === "AGE_CLASS") {
    return { biologicalAgeClass: intent.value };
  }
  return {
    regulatoryClasses: [{ dimension: intent.dimension, value: intent.value }],
  };
}

export function needsAnimalClass(
  requiredDimension: RegulatoryNeedsInput["requiredDimension"],
  prompt: string,
  options: RegulatoryInputOption[],
): RegulatoryNeedsInput {
  return {
    status: "NEEDS_INPUT",
    requiredDimension,
    prompt,
    options,
    sourceDefinitionRequired:
      requiredDimension === "ANTLER_CLASS" ||
      requiredDimension === "BIRD_CHARACTERISTIC" ||
      requiredDimension === "JURISDICTION_DEFINED",
  };
}
