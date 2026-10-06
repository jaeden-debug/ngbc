import { isWithinSupportedBounds } from "./coverage.ts";
import { placeInJurisdiction } from "./jurisdiction-scope.ts";
import { jurisdictionScopedBody } from "./jurisdiction-scope-response.ts";
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
 * One outcome as the public body for it.
 *
 * Every branch returns; the final `never` makes a seventh outcome a compile
 * error here rather than an unserialized answer at runtime.
 */
export function zoneAnswerBody(answer: ZoneAnswer, options: { includeGeometry: boolean }): unknown {
  switch (answer.kind) {
    case "JURISDICTION_SCOPED":
      return jurisdictionScopedBody(answer.resolution);
    case "UNSUPPORTED_US_STATE": {
      const jurisdiction = unitedStatesJurisdictionById(answer.jurisdictionId);
      if (!jurisdiction) return { status: "UNSUPPORTED", message: NO_GEOGRAPHY_MESSAGE };
      return unsupportedUnitedStatesResponse(answer.place, jurisdiction);
    }
    case "NO_GEOGRAPHY":
      return { status: "UNSUPPORTED", message: NO_GEOGRAPHY_MESSAGE };
    case "UNRESOLVED":
      return {
        status: answer.status,
        message: answer.message,
        layer: answer.layer
          ? { jurisdictionName: answer.layer.jurisdictionName, officialTerm: answer.layer.officialTerm, authority: answer.layer.authority }
          : null,
      };
    case "NOT_SERVING":
      return {
        status: "UNSUPPORTED",
        message:
          `This point is in ${answer.layer.jurisdictionName}. North Ground holds its official ` +
          `${answer.layer.officialTerm.toLowerCase()} boundaries but has not finished certifying them against ` +
          `${answer.layer.authority}, so it will not name a zone here yet.`,
      };
    case "RESOLVED":
      return resolvedZoneBody(answer.resolution, answer.layer, { includeGeometry: options.includeGeometry });
    default: {
      const exhaustive: never = answer;
      return exhaustive;
    }
  }
}
