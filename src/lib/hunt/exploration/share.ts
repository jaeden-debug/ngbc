import { invokeNativeShare, copyHuntBriefLink, type ShareNavigator } from "../../hunt-share/client.ts";
import { longDayLabel } from "./date-presets.ts";
import { huntDeepLink, type HuntUrlState } from "./url-state.ts";

/**
 * Sharing a Hunt's context: which zone, which species, which day.
 *
 * The message says what the hunt IS and links to it. It never carries a legal
 * status — a season can close or a rule can change after the message is sent,
 * and the link re-reads the certified rules when it is opened, so the status
 * belongs to the link, not the text. It never carries a coordinate, a place
 * name the person typed, or the device's position.
 */

export interface ShareContext {
  zone: { fullLabel: string; jurisdictionName: string } | null;
  species: { displayName: string } | null;
  date: string;
  state: HuntUrlState;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function huntSharePayload(context: ShareContext, origin: string): SharePayload {
  // The shared day is always explicit: "today" means a different day to whoever opens it tomorrow.
  const url = huntDeepLink({ ...context.state, date: context.date }, origin);
  const day = longDayLabel(context.date);
  const where = context.zone ? `${context.zone.fullLabel} (${context.zone.jurisdictionName})` : null;
  const title = [context.species?.displayName, context.zone?.fullLabel].filter(Boolean).join(" · ") || "North Ground Hunt";
  const text = context.species && where
    ? `${context.species.displayName} in ${where} on ${day} — view this hunt on North Ground.`
    : where
      ? `${where} on ${day} — view this hunting zone on North Ground.`
      : `Hunting zones and seasons on ${day} — North Ground Hunt.`;
  return { title, text, url };
}

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * The device's own share sheet where there is one; otherwise the link is
 * copied. A cancelled share sheet is the person's choice and is not followed
 * by a copy they did not ask for.
 */
export async function shareHunt(navigatorLike: ShareNavigator, payload: SharePayload): Promise<ShareOutcome> {
  const shared = await invokeNativeShare(navigatorLike, payload);
  if (shared === "shared" || shared === "cancelled") return shared;
  const copied = await copyHuntBriefLink(navigatorLike, payload.url);
  return copied === "copied" ? "copied" : "failed";
}
