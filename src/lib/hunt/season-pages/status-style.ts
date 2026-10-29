import type { ExplorationState } from "../exploration/states.ts";

/**
 * Which `.ng-status` treatment each state wears. Styling only: the word beside
 * it is always the state's own label, so nothing is carried by colour, and a
 * season's state is never restyled as a licence ("OPEN" is the glyph, the text
 * says "In season").
 */
export const STATUS_STYLE: Record<ExplorationState, string> = {
  SEASON_AVAILABLE: "OPEN",
  SEASON_EXCEPT_AREAS: "CONDITIONAL",
  CHECK_REQUIREMENTS: "CONDITIONAL",
  NEEDS_VERIFICATION: "NEEDS_VERIFICATION",
  CONFLICT: "CONFLICT",
  CLOSED: "CLOSED",
  UNKNOWN: "UNKNOWN",
  NOT_CERTIFIED: "UNKNOWN",
};
