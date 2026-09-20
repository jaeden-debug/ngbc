import { absoluteUrl } from "../site.ts";
import type { ShareHuntBrief } from "./model.ts";

export function huntBriefPath(shareId: string): string {
  return `/hunt/share/${shareId}`;
}

export function huntBriefUrl(shareId: string): string {
  return absoluteUrl(huntBriefPath(shareId));
}

export function checkCurrentHuntPath(brief: ShareHuntBrief): string {
  const params = new URLSearchParams({
    species: brief.species.id,
    jurisdiction: brief.jurisdiction.id,
    date: brief.selectedDate,
  });
  if (brief.managementZone) params.set("zone", brief.managementZone.id);
  return `/hunt?${params.toString()}`;
}
