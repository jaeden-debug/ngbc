import type { CanonicalId } from "../../content-contract/index.ts";
import type { ZoneCoverageStatus } from "../zone-layers.ts";

/**
 * The map's exploration vocabulary: safe for the browser, holds no rules.
 * The states are produced only by `zone-summary.ts`, on the server, from the
 * canonical regulatory engine.
 */

export type ExplorationState =
  | "SEASON_AVAILABLE"
  | "CHECK_REQUIREMENTS"
  | "CLOSED"
  | "NEEDS_VERIFICATION"
  | "CONFLICT"
  | "UNKNOWN"
  | "NOT_CERTIFIED";

/** Words and a glyph for each state, so no state is carried by colour alone. */
export const EXPLORATION_WORDING: Record<ExplorationState, { label: string; glyph: string; detail: string }> = {
  SEASON_AVAILABLE: {
    label: "In season",
    glyph: "●",
    detail: "A season is open on this date for every licence the rules recognise. Licensing, legal hours and restrictions still apply.",
  },
  CHECK_REQUIREMENTS: {
    label: "Depends on your hunt",
    glyph: "◐",
    detail: "Whether a season is open depends on who is hunting and how — the full check asks.",
  },
  CLOSED: {
    label: "Closed",
    glyph: "○",
    detail: "No season is open here on this date under the certified rules.",
  },
  NEEDS_VERIFICATION: {
    label: "Needs a closer look",
    glyph: "◇",
    detail: "The answer differs within this zone, or falls outside the period North Ground has certified.",
  },
  CONFLICT: {
    label: "Sources disagree",
    glyph: "△",
    detail: "The official sources disagree, and North Ground will not choose between them.",
  },
  UNKNOWN: {
    label: "Not covered here",
    glyph: "?",
    detail: "No certified rule covers this species in this zone. That is a gap in coverage, not a closed season.",
  },
  NOT_CERTIFIED: {
    label: "Not certified",
    glyph: "–",
    detail: "North Ground has no certified rules for this species in this jurisdiction.",
  },
};

export interface ZoneRef {
  layerId: string;
  designation: string;
}

export interface SpeciesZoneSummary {
  speciesId: CanonicalId<"species">;
  name: string;
  state: ExplorationState;
  /** The certified season window containing the date, when the engine states one. */
  season?: { opens: string; closes: string };
  /** The first fact the engine would ask, in its own words, when the hunter decides. */
  question?: string;
  /** One sentence the engine produced about this zone, when it adds something. */
  detail?: string;
  verifiedAt?: string;
}

export interface ZoneSummary {
  zone: {
    layerId: string;
    designation: string;
    label: string;
    officialName: string;
    officialTerm: string;
    jurisdictionId: CanonicalId<"jurisdiction">;
    jurisdictionName: string;
    authority: string;
    coverage: ZoneCoverageStatus;
    sourceId: CanonicalId<"source">;
  };
  date: string;
  species: SpeciesZoneSummary[];
  /** Certified requirements that apply to an in-season species here on this date, verbatim with their section. */
  requirements: string[];
  /** What a zone-wide answer cannot see, in the authority's own categories. */
  pointOnlyChecks: string | null;
  counts: { certifiedHere: number; inSeason: number; dependsOnHunter: number; jurisdictionSpecies: number };
  /** The most recent date the underlying rules were read from their source. */
  verifiedAt: string | null;
}

