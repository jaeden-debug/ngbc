import { isWithinSupportedBounds } from "./coverage.ts";
import { placeInJurisdiction } from "./jurisdiction-scope.ts";
import { jurisdictionScopedBody, type JurisdictionScopedBody } from "./jurisdiction-scope-response.ts";
import { unitedStatesJurisdictionById } from "./united-states/registry.ts";
import { couldBeUnitedStatesState, unitedStatesStateAt } from "./united-states/state-boundary.ts";
import { unsupportedUnitedStatesResponse } from "./united-states/unsupported-response.ts";
import { resolveZone } from "./zone.ts";
import { layerForJurisdiction, layerForPoint, layerForResolution, type ZoneLayer } from "./zone-layers.ts";
import { resolvedZoneBody } from "./zone-response.ts";
import type { ZoneResolution } from "./types.ts";

/**
 * What North Ground can say about a point, as a closed set of outcomes.
 *
 * WHY THIS IS A DOMAIN TYPE AND NOT A RESPONSE SHAPE. This composition lived
 * entirely inside `app/api/hunt/zone/route.ts` — 126 lines choosing between six
 * outcomes across seven branches, three of which had named serializers and
 * three of which were object literals written inline. Nothing else in the
 * repository could reach that decision, so a second interface asking "which
 * zone is this, and will we answer about it" would have had to decide it again
 * and independently.
 *
 * That is not legality, so it is not literally the one-domain-truth rule about
 * the regulatory engine. It is the same defect in the same place: two
 * interfaces maintaining their own version of an answer. The opportunity path
 * had exactly this shape — Ontario's map said GREEN while its card could name
 * nothing — and it was invisible until the two were compared.
 *
 * THE UNION IS EXHAUSTIVE ON PURPOSE. A seventh outcome must fail to compile in
 * every serializer rather than fall through one of them and be rendered as
 * whichever branch happens to sit last.
 *
 * WHAT NO TEST REACHED. Before this existed, the whole suite was instrumented
 * at all eight outcome sites and run: **not one of the six was reached by any
 * test**. The route was also outside every `npm test` glob, so a test placed
 * beside it would not have run either. Both are fixed; this type is what makes
 * the outcomes reachable from a test at all.
 */
export type ZoneAnswer =
  /** Placed in a jurisdiction whose certified rules are statewide; no zone. */
  | { kind: "JURISDICTION_SCOPED"; resolution: ZoneResolution }
  /** A U.S. state North Ground has not certified; named, with its authority. */
  | { kind: "UNSUPPORTED_US_STATE"; place: { jurisdictionId: string; name: string; code: string }; jurisdictionId: string }
  /** No official boundaries published here. A coverage gap, never a hunting statement. */
  | { kind: "NO_GEOGRAPHY" }
  /** The resolver could not name a zone; the layer is context, not an answer. */
  | { kind: "UNRESOLVED"; status: string; message: string; layer: ZoneLayer | null }
  /** Boundaries held but not yet certified against the authority. */
  | { kind: "NOT_SERVING"; layer: ZoneLayer }
  /** A certified zone. */
  | { kind: "RESOLVED"; resolution: ZoneResolution; layer: ZoneLayer };

export interface ZoneAnswerResult {
  answer: ZoneAnswer;
  /** Phase durations, for Server-Timing. Empty when the resolver never ran. */
  timings: Record<string, number>;
}

/**
 * Resolve a coordinate to one of the six outcomes.
 *
 * `fetcher` is injected so the outcomes are reachable from a test. They were
 * not before: every one of them needed the network, so none was covered.
 */
export async function resolveZoneAnswer(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneAnswerResult> {
  const timings: Record<string, number> = {};

  /* The extent check only decides whether to ask the registry at all. Which
     jurisdiction a zone belongs to comes from the zone, below. */
  const hint = layerForPoint(latitude, longitude);
  if (!hint || !isWithinSupportedBounds(latitude, longitude)) {
    /* A state whose certified rules are all statewide draws no layer, so its
       points arrive here. The Census boundary places them for those rules and
       nothing else (§41A); the body has no zone in it. */
    const placement = await placeInJurisdiction(latitude, longitude, fetcher);
    if (placement.kind === "SCOPED") return { answer: { kind: "JURISDICTION_SCOPED", resolution: placement.resolution }, timings };
    const place = couldBeUnitedStatesState(latitude, longitude)
      ? await unitedStatesStateAt(latitude, longitude, fetcher)
      : undefined;
    const jurisdiction = place ? unitedStatesJurisdictionById(place.jurisdictionId) : undefined;
    if (place && jurisdiction) return { answer: { kind: "UNSUPPORTED_US_STATE", place, jurisdictionId: jurisdiction.id }, timings };
    return { answer: { kind: "NO_GEOGRAPHY" }, timings };
  }

  const started = performance.now();
  const resolution = await resolveZone(latitude, longitude, fetcher, undefined, timings);
  timings.resolve = performance.now() - started;

  /* Placed in a statewide jurisdiction rather than a zone: a hunting layer's
     rectangle reaching over the point (Ontario's reaches over Iowa) never
     makes the point that layer's. */
  if (resolution.jurisdictionScope) return { answer: { kind: "JURISDICTION_SCOPED", resolution }, timings };

  const usState = resolution.status !== "RESOLVED" ? unitedStatesJurisdictionById(resolution.jurisdictionId ?? "") : undefined;
  if (usState && !layerForJurisdiction(resolution.jurisdictionId)) {
    const code = usState.id.slice(-2).toUpperCase();
    return {
      answer: { kind: "UNSUPPORTED_US_STATE", place: { jurisdictionId: usState.id, name: usState.nameEn, code }, jurisdictionId: usState.id },
      timings,
    };
  }

  if (resolution.status !== "RESOLVED") {
    /* Named only when the resolver could attribute the point to one
       jurisdiction; where extents overlap, the first box is not an answer. */
    return {
      answer: {
        kind: "UNRESOLVED",
        status: resolution.status,
        message: resolution.message ?? "",
        layer: layerForJurisdiction(resolution.jurisdictionId) ?? null,
      },
      timings,
    };
  }

  const presented = layerForResolution(resolution);
  if (presented.kind === "NOT_SERVING") return { answer: { kind: "NOT_SERVING", layer: presented.layer }, timings };
  if (presented.kind !== "SERVING") return { answer: { kind: "NO_GEOGRAPHY" }, timings };
  return { answer: { kind: "RESOLVED", resolution, layer: presented.layer }, timings };
}

/** The message for ground North Ground publishes no boundaries for. */
const NO_GEOGRAPHY_MESSAGE =
  "North Ground does not yet publish official hunting-zone boundaries for this area. " +
  "That is a gap in our coverage, not a statement about hunting there.";

/**
 * THE WIRE SHAPE OF EACH OUTCOME, DECLARED.
 *
 * `zoneAnswerBody` returned `unknown`. The exhaustiveness check below made a
 * SEVENTH outcome a compile error, which is real, but it said nothing about
 * what any arm returns: the RESOLVED arm could return the JURISDICTION_SCOPED
 * body and typecheck, because `unknown` accepts everything. An extracted
 * serializer whose output is untyped cannot be the contract a second interface
 * reads, which is the whole reason the extraction happened.
 *
 * A plain union return type would NOT have fixed that — swapping two arms
 * returns a different member of the same union and still typechecks. What
 * makes the swap a compile error is keying each body to the outcome it
 * serializes, which is why `outcome` exists.
 *
 * `outcome` IS ALSO A FACT THE WIRE WAS LOSING. Four of the six outcomes
 * serialize to `status: "UNSUPPORTED"` — NO_GEOGRAPHY, NOT_SERVING, and both
 * UNSUPPORTED_US_STATE paths — so a reader branching on `status` cannot tell
 * "no authority publishes boundaries here" from "we hold this authority's
 * boundaries and have not finished certifying them". Those are different
 * findings about the ground and §8 does not let one stand for the other. The
 * distinction survived only in the prose message. It is the same collapse
 * 1da28014 named as its own counterfactual — prevented in the domain union,
 * and then performed by the serializer reading it.
 *
 * ADDITIVE ON PURPOSE. `status` and every existing field keep their values, so
 * the Hunt client — which types `status` as a bare string and branches on
 * "RESOLVED" and "JURISDICTION" — is unaffected.
 */
export type ZoneAnswerBody =
  | ({ outcome: "JURISDICTION_SCOPED" } & JurisdictionScopedBody)
  | ({ outcome: "UNSUPPORTED_US_STATE" } & ReturnType<typeof unsupportedUnitedStatesResponse>)
  | { outcome: "UNSUPPORTED_US_STATE"; status: "UNSUPPORTED"; message: string }
  | { outcome: "NO_GEOGRAPHY"; status: "UNSUPPORTED"; message: string }
  | {
      outcome: "UNRESOLVED";
      status: string;
      message: string;
      layer: { jurisdictionName: string; officialTerm: string; authority: string } | null;
    }
  | { outcome: "NOT_SERVING"; status: "UNSUPPORTED"; message: string }
  | ({ outcome: "RESOLVED" } & ReturnType<typeof resolvedZoneBody>);

/** The body type for one outcome. This is what makes an arm swap not compile. */
export type ZoneAnswerBodyFor<K extends ZoneAnswer["kind"]> = Extract<ZoneAnswerBody, { outcome: K }>;

interface BodyOptions { includeGeometry: boolean }

/**
 * One serializer per outcome, each checked against the body declared for THAT
 * outcome. The arm swap this closes would happen inside one of these functions,
 * so that is where the type has to bite; the dispatch below is a lookup.
 */
const BODIES: { [K in ZoneAnswer["kind"]]: (answer: Extract<ZoneAnswer, { kind: K }>, options: BodyOptions) => ZoneAnswerBodyFor<K> } = {
  JURISDICTION_SCOPED: (answer) => ({ outcome: "JURISDICTION_SCOPED", ...jurisdictionScopedBody(answer.resolution) }),
  UNSUPPORTED_US_STATE: (answer) => {
    const jurisdiction = unitedStatesJurisdictionById(answer.jurisdictionId);
    /* A state we cannot name is still not a statement about hunting there. */
    if (!jurisdiction) return { outcome: "UNSUPPORTED_US_STATE", status: "UNSUPPORTED", message: NO_GEOGRAPHY_MESSAGE };
    return { outcome: "UNSUPPORTED_US_STATE", ...unsupportedUnitedStatesResponse(answer.place, jurisdiction) };
  },
  NO_GEOGRAPHY: () => ({ outcome: "NO_GEOGRAPHY", status: "UNSUPPORTED", message: NO_GEOGRAPHY_MESSAGE }),
  UNRESOLVED: (answer) => ({
    outcome: "UNRESOLVED",
    status: answer.status,
    message: answer.message,
    layer: answer.layer
      ? { jurisdictionName: answer.layer.jurisdictionName, officialTerm: answer.layer.officialTerm, authority: answer.layer.authority }
      : null,
  }),
  NOT_SERVING: (answer) => ({
    outcome: "NOT_SERVING",
    status: "UNSUPPORTED",
    message:
      `This point is in ${answer.layer.jurisdictionName}. North Ground holds its official ` +
      `${answer.layer.officialTerm.toLowerCase()} boundaries but has not finished certifying them against ` +
      `${answer.layer.authority}, so it will not name a zone here yet.`,
  }),
  RESOLVED: (answer, options) => ({ outcome: "RESOLVED", ...resolvedZoneBody(answer.resolution, answer.layer, { includeGeometry: options.includeGeometry }) }),
};

/**
 * One outcome as the public body for it.
 *
 * No casts: each case narrows `answer` to one kind, so the serializer for that
 * kind is called with the only answer it accepts and returns the only body it
 * may return. A missing outcome fails at `BODIES`, which must name every member
 * of the union; a seventh fails at the `never` below.
 */
export function zoneAnswerBody(answer: ZoneAnswer, options: BodyOptions): ZoneAnswerBody {
  switch (answer.kind) {
    case "JURISDICTION_SCOPED": return BODIES.JURISDICTION_SCOPED(answer, options);
    case "UNSUPPORTED_US_STATE": return BODIES.UNSUPPORTED_US_STATE(answer, options);
    case "NO_GEOGRAPHY": return BODIES.NO_GEOGRAPHY(answer, options);
    case "UNRESOLVED": return BODIES.UNRESOLVED(answer, options);
    case "NOT_SERVING": return BODIES.NOT_SERVING(answer, options);
    case "RESOLVED": return BODIES.RESOLVED(answer, options);
    default: {
      const exhaustive: never = answer;
      return exhaustive;
    }
  }
}
