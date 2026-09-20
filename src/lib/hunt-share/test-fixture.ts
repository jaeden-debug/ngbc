import type { HuntShareProjectionInput, ShareHuntBriefV1 } from "./model.ts";

export const testShareId = "A234567890bcdefghijklmno";

export function huntShareInput(
  overrides: Partial<HuntShareProjectionInput> = {},
): HuntShareProjectionInput {
  return {
    species: { id: "species:ruffed-grouse", displayName: "Ruffed grouse" },
    jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
    managementZone: {
      id: "management_zone:ca-on-wmu-57",
      displayName: "Wildlife Management Unit 57",
    },
    selectedDate: "2026-10-24",
    regulatory: {
      status: "CONDITIONAL",
      summary: "The certified season table includes this date, subject to all listed conditions.",
      verifiedAt: "2026-09-20T12:00:00.000Z",
      sourceDataVersion: "ontario-2026",
      season: { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true },
    },
    legalTime: {
      status: "RULE_ONLY",
      summary: "Thirty minutes before sunrise to thirty minutes after sunset, subject to exceptions.",
      verified: true,
      verifiedAt: "2026-09-20T12:00:00.000Z",
    },
    weather: {
      status: "available",
      summary: "Forecast: 2 to 9 °C with light rain possible.",
      asOf: "2026-09-20T12:00:00.000Z",
      validFor: "2026-10-24",
    },
    warnings: ["Conditions apply. Confirm all official rules before hunting."],
    officialSources: [
      {
        id: "source:ca-on-small-game-2026",
        authority: "Ontario Ministry of Natural Resources",
        title: "2026 Ontario Hunting Regulations Summary",
        url: "https://www.ontario.ca/document/ontario-hunting-regulations-summary",
        verifiedAt: "2026-09-20T12:00:00.000Z",
        effectiveDate: "2026",
      },
    ],
    resourceReferences: [
      {
        id: "species:ruffed-grouse",
        title: "Ruffed grouse",
        href: "/hunting/species/ruffed-grouse",
      },
    ],
    location: {
      generalLabel: "Near Bancroft",
      shareApproved: true,
      latitude: 45.057,
      longitude: -77.857,
      rawInput: "private cabin address",
      postalCode: "K0L 1C0",
      address: "123 Private Road",
    },
    privateContext: { accountId: "private-account", sessionId: "private-session" },
    ...overrides,
  };
}

export function huntBriefFixture(
  overrides: Partial<ShareHuntBriefV1> = {},
): ShareHuntBriefV1 {
  return {
    version: 1,
    shareId: testShareId,
    createdAt: "2026-09-20T12:00:00.000Z",
    species: { id: "species:ruffed-grouse", displayName: "Ruffed grouse" },
    jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
    managementZone: {
      id: "management_zone:ca-on-wmu-57",
      displayName: "Wildlife Management Unit 57",
    },
    selectedDate: "2026-10-24",
    generalLocationLabel: "Near Bancroft",
    regulatory: {
      status: "CONDITIONAL",
      summary: "The certified season table includes this date, subject to all listed conditions.",
      verifiedAt: "2026-09-20T12:00:00.000Z",
      sourceDataVersion: "ontario-2026",
      season: { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true },
    },
    legalTime: {
      status: "RULE_ONLY",
      summary: "Thirty minutes before sunrise to thirty minutes after sunset, subject to exceptions.",
      verifiedAt: "2026-09-20T12:00:00.000Z",
    },
    weatherSnapshot: {
      status: "available",
      summary: "Forecast: 2 to 9 °C with light rain possible.",
      asOf: "2026-09-20T12:00:00.000Z",
      validFor: "2026-10-24",
    },
    warnings: ["Conditions apply. Confirm all official rules before hunting."],
    officialSources: [
      {
        id: "source:ca-on-small-game-2026",
        authority: "Ontario Ministry of Natural Resources",
        title: "2026 Ontario Hunting Regulations Summary",
        url: "https://www.ontario.ca/document/ontario-hunting-regulations-summary",
        verifiedAt: "2026-09-20T12:00:00.000Z",
        effectiveDate: "2026",
      },
    ],
    resourceReferences: [
      {
        id: "species:ruffed-grouse",
        title: "Ruffed grouse",
        href: "/hunting/species/ruffed-grouse",
      },
    ],
    ...overrides,
  };
}
