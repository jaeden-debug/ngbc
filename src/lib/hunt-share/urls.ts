import { absoluteUrl } from "../site.ts";
import type { ShareHuntBriefV1 } from "./model.ts";

export function huntBriefPath(shareId: string): string {
  return `/hunt/share/${shareId}`;
}

export function huntBriefUrl(shareId: string): string {
  return absoluteUrl(huntBriefPath(shareId));
}

export function checkCurrentHuntPath(brief: ShareHuntBriefV1): string {
  const params = new URLSearchParams({
    species: brief.species.id,
    jurisdiction: brief.jurisdiction.id,
    date: brief.selectedDate,
  });
  if (brief.managementZone) params.set("zone", brief.managementZone.id);
  return `/hunt?${params.toString()}`;
}
