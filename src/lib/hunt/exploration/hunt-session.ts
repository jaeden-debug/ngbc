import type { CanonicalId } from "../../content-contract/index.ts";
import type { HuntEvaluation } from "../types.ts";
import type { GeoPoint } from "./map-state.ts";

/**
 * What a Hunt is being asked, and what has been answered — as one machine.
 *
 * Location lives in the map's own machine (`map-state.ts`), which is the only
 * place the hunt location can change. This one holds the rest of the question —
 * species, date, the hunter's answers — and the evaluation, and it is what makes
 * the Hunt state-driven rather than a form: whenever location, species and date
 * are all present the interface asks the engine, and whenever any of them
 * changes the previous answer stops being shown.
 *
 * Two rules the tests hold:
 *
 *  - A response is accepted only for the question it answers. Every request
 *    carries the key of the inputs it was sent with; a response whose key is
 *    not the one currently awaited is dropped, so a slow answer about deer can
 *    never appear under a question about moose.
 *  - The hunter's answers belong to one hunt. A different species, day or
 *    place clears them, because "resident, shotgun" for deer in WMU 71 must not
 *    quietly decide a moose hunt two units away.
 */

export type EvaluationState =
  | { kind: "idle" }
  | { kind: "loading"; key: string }
  | { kind: "ready"; key: string; result: HuntEvaluation }
  | { kind: "error"; key: string; message: string };

export interface HuntSession {
  speciesId: CanonicalId<"species"> | null;
  /** `explicit` is false while the day is the device's default "today". */
  date: { iso: string; explicit: boolean };
  answers: Record<string, string>;
  evaluation: EvaluationState;
  /** The map is coloured by the selected species' season status. */
  explore: boolean;
}

export type HuntSessionEvent =
  | { type: "SPECIES_CHOSEN"; speciesId: CanonicalId<"species"> }
  | { type: "SPECIES_CLEARED" }
  | { type: "DATE_CHOSEN"; iso: string }
  /** The device's own today, applied once after the server rendered the jurisdiction's. */
  | { type: "DEFAULT_DATE_CORRECTED"; iso: string }
  | { type: "ANSWERED"; dimensionId: string; value: string }
  | { type: "LOCATION_CHANGED" }
  | { type: "EVALUATION_STARTED"; key: string }
  | { type: "EVALUATION_SUCCEEDED"; key: string; result: HuntEvaluation }
  | { type: "EVALUATION_FAILED"; key: string; message: string }
  | { type: "EVALUATION_CLEARED" }
  | { type: "EXPLORE_SET"; on: boolean };

export function initialSession(input: {
  speciesId: CanonicalId<"species"> | null;
  date: string;
  dateExplicit: boolean;
  explore: boolean;
}): HuntSession {
  return {
    speciesId: input.speciesId,
    date: { iso: input.date, explicit: input.dateExplicit },
    answers: {},
    evaluation: { kind: "idle" },
    explore: input.explore && Boolean(input.speciesId),
  };
}

function fresh(state: HuntSession): HuntSession {
  return { ...state, answers: {}, evaluation: { kind: "idle" } };
}

export function huntSessionReducer(state: HuntSession, event: HuntSessionEvent): HuntSession {
  switch (event.type) {
    case "SPECIES_CHOSEN":
      return state.speciesId === event.speciesId ? state : { ...fresh(state), speciesId: event.speciesId };
    case "SPECIES_CLEARED":
      return { ...fresh(state), speciesId: null, explore: false };
    case "DATE_CHOSEN":
      return state.date.iso === event.iso && state.date.explicit
        ? state
        : { ...fresh(state), date: { iso: event.iso, explicit: true } };
    case "DEFAULT_DATE_CORRECTED":
      // Never overrides a day the person chose, or a day a link named.
      if (state.date.explicit || state.date.iso === event.iso) return state;
      return { ...fresh(state), date: { iso: event.iso, explicit: false } };
    case "ANSWERED":
      return { ...state, answers: { ...state.answers, [event.dimensionId]: event.value } };
    case "LOCATION_CHANGED":
      return fresh(state);
    case "EVALUATION_STARTED":
      return { ...state, evaluation: { kind: "loading", key: event.key } };
    case "EVALUATION_SUCCEEDED":
      if (state.evaluation.kind !== "loading" || state.evaluation.key !== event.key) return state;
      return { ...state, evaluation: { kind: "ready", key: event.key, result: event.result } };
    case "EVALUATION_FAILED":
      if (state.evaluation.kind !== "loading" || state.evaluation.key !== event.key) return state;
      return { ...state, evaluation: { kind: "error", key: event.key, message: event.message } };
    case "EVALUATION_CLEARED":
      return state.evaluation.kind === "idle" ? state : { ...state, evaluation: { kind: "idle" } };
    case "EXPLORE_SET":
      return { ...state, explore: event.on && Boolean(state.speciesId) };
    default:
      return state;
  }
}

/**
 * The key of one evaluation's inputs. Equal inputs give equal keys whatever
 * order the answers were given in, so a result can be recognised as current.
 */
export function evaluationKey(input: {
  point: GeoPoint;
  speciesId: string;
  date: string;
  answers: Record<string, string>;
}): string {
  const answers = Object.keys(input.answers).sort().map((key) => [key, input.answers[key]]);
  return JSON.stringify([
    Number(input.point.latitude.toFixed(6)), Number(input.point.longitude.toFixed(6)),
    input.speciesId, input.date, answers,
  ]);
}

/** The evaluation to show for the current inputs, or null: never a result for other inputs. */
export function currentResult(state: HuntSession, key: string | null): HuntEvaluation | null {
  return key && state.evaluation.kind === "ready" && state.evaluation.key === key ? state.evaluation.result : null;
}

/**
 * The answers as the evaluation API reads them.
 *
 * Questions are keyed by dimension id, and an animal-class dimension's id is
 * `ANIMAL_CLASS:<class>`. The API does not accept that as a key: it takes
 * animal classes as a list of `{ dimension, value }`. Sending the raw key made
 * the request malformed, so answering "antlered or antlerless?" returned an
 * error instead of a season.
 */
export function toAnswerPayload(answers: Record<string, string>): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {};
  const animalClasses: Array<{ dimension: string; value: string }> = [];
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith("ANIMAL_CLASS:")) animalClasses.push({ dimension: key.slice("ANIMAL_CLASS:".length), value });
    else payload[key] = value;
  }
  if (animalClasses.length) payload.animalClasses = animalClasses;
  return Object.keys(payload).length ? payload : undefined;
}
