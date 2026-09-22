import type { HuntDimensionAnswers } from "./regulatory/dimensions.ts";

/**
 * The answers a person has given, as `/api/hunt/evaluate` accepts them.
 *
 * The interface keeps answers keyed by the question's dimension id, because
 * that is how a question finds its own answer. Animal classes are asked as
 * `ANIMAL_CLASS:<dimension>` but travel as `animalClasses: [{ dimension,
 * value }]`; sending the question id instead is refused by the endpoint's
 * allowlist, which is right to refuse it. Everything else passes through for
 * the endpoint and the engine to validate. Empty answers are omitted.
 */
export function toAnswerPayload(answers: Readonly<Record<string, string>>): HuntDimensionAnswers | undefined {
  const payload: Record<string, unknown> = {};
  const animalClasses: Array<{ dimension: string; value: string }> = [];
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith("ANIMAL_CLASS:")) animalClasses.push({ dimension: key.slice("ANIMAL_CLASS:".length), value });
    else payload[key] = value;
  }
  if (animalClasses.length) payload.animalClasses = animalClasses;
  return Object.keys(payload).length ? (payload as HuntDimensionAnswers) : undefined;
}

/** The body the composer posts to `/api/hunt/evaluate`. */
export function evaluateRequestBody(
  hunt: { latitude: number; longitude: number; date: string; speciesId: string },
  answers: Readonly<Record<string, string>>,
) {
  return { ...hunt, answers: toAnswerPayload(answers) };
}
