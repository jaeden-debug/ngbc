import type { HuntShareProjectionInput } from "./model.ts";

export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: Pick<Clipboard, "writeText">;
}

export type NativeShareResult = "shared" | "unsupported" | "cancelled" | "failed";
export type CopyLinkResult = "copied" | "failed";

export function createHuntBriefRequestPayload(
  input: HuntShareProjectionInput,
): HuntShareProjectionInput {
  return {
    species: { ...input.species },
    jurisdiction: { ...input.jurisdiction },
    managementZone: input.managementZone ? { ...input.managementZone } : undefined,
    selectedDate: input.selectedDate,
    regulatory: { ...input.regulatory },
    legalTime: input.legalTime ? { ...input.legalTime } : undefined,
    weather: input.weather ? { ...input.weather } : undefined,
    warnings: input.warnings ? [...input.warnings] : undefined,
    officialSources: input.officialSources?.map((source) => ({ ...source })),
    resourceReferences: input.resourceReferences?.map((resource) => ({ ...resource })),
    location:
      input.location?.shareApproved === true && input.location.generalLabel
        ? {
            generalLabel: input.location.generalLabel,
            shareApproved: true,
          }
        : undefined,
  };
}

export async function invokeNativeShare(
  navigatorLike: ShareNavigator,
  data: ShareData,
): Promise<NativeShareResult> {
  if (!navigatorLike.share) return "unsupported";
  try {
    await navigatorLike.share(data);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "failed";
  }
}

export async function copyHuntBriefLink(
  navigatorLike: ShareNavigator,
  url: string,
): Promise<CopyLinkResult> {
  if (!navigatorLike.clipboard?.writeText) return "failed";
  try {
    await navigatorLike.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
