import type { Metadata } from "next";
import type { ShareHuntBrief } from "./model.ts";
import { huntBriefUrl } from "./urls.ts";
import { briefZoneLabels } from "./zone-label.ts";

const noIndexRobots = { index: false, follow: true, noarchive: true } as const;

export function unavailableHuntBriefMetadata(): Metadata {
  return {
    title: "Hunt Brief unavailable",
    description: "This shared North Ground Hunt Brief is unavailable.",
    robots: noIndexRobots,
  };
}

export function buildHuntBriefMetadata(brief: ShareHuntBrief): Metadata {
  const zone = briefZoneLabels(brief.managementZone)?.label ?? brief.jurisdiction.displayName;
  const title = `${brief.species.displayName} Hunt — ${zone}`;
  const description = `${brief.selectedDate} · ${brief.regulatory.status.replaceAll("_", " ")} · Shared North Ground Hunt Brief. Check current rules before hunting.`;
  const canonical = huntBriefUrl(brief.shareId);
  const image = `${canonical}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: noIndexRobots,
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "North Ground",
      locale: "en_CA",
      images: [{ url: image, width: 1200, height: 630, alt: `${brief.species.displayName} North Ground Hunt Brief` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
