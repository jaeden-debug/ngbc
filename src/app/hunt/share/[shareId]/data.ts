import { cache } from "react";
import { getHuntBrief, type HuntBriefLookupResult } from "../../../../lib/hunt-share/service.ts";

export type SharePageData = HuntBriefLookupResult | { status: "unavailable" };

export const loadHuntBrief = cache(async (shareId: string): Promise<SharePageData> => {
  try {
    return await getHuntBrief(shareId);
  } catch {
    return { status: "unavailable" };
  }
});
