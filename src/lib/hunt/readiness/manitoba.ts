import { authorizationRows } from "./requirements.ts";
import { resolveAuthorizations, type HunterAnswers } from "./resolve.ts";
import type {
  AuthorizationRecord, AuthorizationRequirement, LegalMethod, OrangeResult, Price, Provenance, ReadinessResult,
} from "./types.ts";
import type { RegulatoryResult } from "../types.ts";

/**
 * Manitoba's Ready to Hunt.
 *
 * Which licence a hunt needs is not re-derived here: Manitoba's engine already
 * asked it (M.R. 165/91 s. 3 — a licence lets you hunt only the species, areas,
 * equipment and seasons designated for it), so the checklist reads the licence
 * the hunter named and adds what every Manitoba licence needs first.
 *
 * Sources, each read in full:
 *   - 2026 Manitoba Hunting Guide p. 7 (licence fees, in force from
 *     1 April 2026, and which licences are sold only through outfitters) and
 *     p. 9 (hunter education, how to buy);
 *   - M.R. 165/91 (licence names, s. 3.2–3.4 equipment, s. 29.1);
 *   - M.R. 351/87 s. 10 (hunter orange), whose application to a hunt the
 *     regulatory answer already carries as conditions.
 */

const GUIDE = "source:ca-mb-hunting-guide-2026";
const GUIDE_URL = "https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/huntingguide.pdf";
const SEASONS = "source:ca-mb-hunting-seasons-regulation";
const SEASONS_URL = "https://web2.gov.mb.ca/laws/regs/current/165-91.php";
const GENERAL = "source:ca-mb-general-hunting-regulation";
const GENERAL_URL = "https://web2.gov.mb.ca/laws/regs/current/351-87.php";
const ELICENSING = "https://manitobaelicensing.ca";
const PHONE = "1-877-880-1203";
const AUTHORITY = "Manitoba Natural Resources and Indigenous Futures";
const RETRIEVED = "2026-10-30";
const LICENCE_YEAR = 2026;

const guide = (page: string, citation: string): Provenance => ({
  sourceId: GUIDE, url: GUIDE_URL, citation: `2026 Manitoba Hunting Guide, ${page}${citation ? `, ${citation}` : ""}`, tier: "OFFICIAL_SUMMARY", retrievedAt: RETRIEVED,
});
const fees = (): Provenance => ({ ...guide("p. 7", "Licence fees"), tier: "OFFICIAL_FEE_SCHEDULE" });
const law = (section: string): Provenance => ({ sourceId: SEASONS, url: SEASONS_URL, citation: `M.R. 165/91 ${section}`, tier: "LAW", retrievedAt: RETRIEVED });
const generalLaw = (section: string): Provenance => ({ sourceId: GENERAL, url: GENERAL_URL, citation: `M.R. 351/87 ${section}`, tier: "LAW", retrievedAt: RETRIEVED });

/* The guide's fee table says the figures took effect on 1 April 2026, the
   start of the 2026-27 hunting year (M.R. 165/91 s. 1). */
const price = (amount: number, label: string, variant?: string): Price => ({
  amount, currency: "CAD", label, licenceYear: LICENCE_YEAR, appliesTo: {},
  ...(variant ? { variant } : {}),
  figureInForce: { effectiveFrom: "2026-04-01", statedAs: "As of April 1, 2026, the Manitoba government has updated fees for wildlife licences." },
  chargeType: "LICENCE_FEE",
  provenance: fees(),
});

const HUNTER_EDUCATION_ID = "authorization:ca-mb-hunter-education" as AuthorizationRecord["id"];

const ONLINE = { channels: ["ONLINE", "PHONE", "PHYSICAL_VENDOR"] as const, onlineUrl: ELICENSING, phone: PHONE, infoUrl: ELICENSING };
const OUTFITTER = {
  channels: ["LICENSED_OPERATOR"] as const,
  infoUrl: ELICENSING,
  note: "Available only through outfitters (2026 guide, p. 7).",
};
const DRAW_INFO = "https://www.gov.mb.ca/nrnd/fish-wildlife/hunting/index.html";

interface LicenceSpec {
  name: string;
  kind: AuthorizationRecord["kind"];
  provenance: Provenance[];
  prices: Price[];
  purchase: typeof ONLINE | typeof OUTFITTER;
  draw?: boolean;
  feeNote?: string;
  note?: string;
}

/* Keyed by the engine's own LICENCE_TYPE values (src/lib/hunt/regulatory/manitoba.ts). */
const LICENCES: Record<string, LicenceSpec> = {
  MB_RESIDENT_GAME_BIRD: {
    name: "Manitoba resident game bird licence", kind: "SPECIES_LICENCE", provenance: [law("s. 5(1)")], purchase: ONLINE,
    prices: [price(37, "Game Birds — Manitoba resident"), price(20.75, "Deer and Game Bird Licence — Manitoba resident (youth)", "youth")],
  },
  CANADIAN_RESIDENT_GAME_BIRD: {
    name: "Canadian resident game bird licence", kind: "SPECIES_LICENCE", provenance: [law("s. 5(1)")], purchase: ONLINE,
    prices: [price(108, "Game Birds — Canadian resident")],
  },
  NON_CANADIAN_UPLAND_GAME_BIRD: {
    name: "Non-Canadian resident upland game bird licence", kind: "SPECIES_LICENCE", provenance: [law("s. 5(2)")], purchase: ONLINE,
    prices: [price(184, "Game Birds — Non-Canadian resident Upland Game Bird")],
  },
  MB_RESIDENT_GENERAL_WTD: {
    name: "Manitoba resident general white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 8")], purchase: ONLINE,
    prices: [price(48, "White-tailed Deer — Manitoba resident (general)"), price(20.75, "Deer and Game Bird Licence — Manitoba resident (youth)", "youth")],
  },
  MB_RESIDENT_SECOND_WTD: {
    name: "Manitoba resident second white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 9")], purchase: ONLINE,
    prices: [price(32.25, "White-tailed Deer — Second Deer (Manitoba resident)")],
  },
  MB_RESIDENT_THIRD_WTD: {
    name: "Manitoba resident third white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 10")], purchase: ONLINE,
    prices: [price(32.25, "White-tailed Deer — Third Deer (Manitoba resident)")],
  },
  CANADIAN_RESIDENT_GENERAL_WTD: {
    name: "Canadian resident general white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 10.1")], purchase: ONLINE,
    prices: [price(184.25, "White-tailed Deer — Canadian resident")],
  },
  NON_CANADIAN_GENERAL_WTD: {
    name: "Non-Canadian resident general white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 10.2(1)")], purchase: OUTFITTER,
    prices: [price(262.5, "White-tailed Deer — Non-Canadian resident (archery, muzzleloader, general)")],
  },
  NON_CANADIAN_ARCHERY_WTD: {
    name: "Non-Canadian resident archery white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 10.2(2)")], purchase: OUTFITTER,
    prices: [price(262.5, "White-tailed Deer — Non-Canadian resident (archery, muzzleloader, general)")],
  },
  NON_CANADIAN_MUZZLELOADER_WTD: {
    name: "Non-Canadian resident muzzleloader white-tailed deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 10.2(3)")], purchase: OUTFITTER,
    prices: [price(262.5, "White-tailed Deer — Non-Canadian resident (archery, muzzleloader, general)")],
  },
  MB_RESIDENT_GENERAL_MULE_DEER: {
    name: "Manitoba resident general mule deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 11.1")], purchase: ONLINE,
    prices: [price(5.75, "Mule Deer — Manitoba resident (general)")],
  },
  MB_RESIDENT_SECOND_MULE_DEER: {
    name: "Manitoba resident second mule deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 11.2")], purchase: ONLINE,
    prices: [price(5.75, "Mule Deer — Second Deer (Manitoba resident)")],
  },
  MB_RESIDENT_THIRD_MULE_DEER: {
    name: "Manitoba resident third mule deer licence", kind: "SPECIES_LICENCE", provenance: [law("s. 11.3")], purchase: ONLINE,
    prices: [price(5.75, "Mule Deer — Third Deer (Manitoba resident)")],
  },
  /* The guide prints one elk fee, and every Manitoba elk licence is drawn. */
  MB_RESIDENT_DRAW_ARCHERY_ELK: {
    name: "Manitoba resident draw archery elk licence", kind: "DRAW_AUTHORIZATION", provenance: [law("s. 12")], purchase: ONLINE, draw: true,
    prices: [price(67.2, "Elk — Manitoba resident")],
  },
  MB_RESIDENT_DRAW_GENERAL_ELK: {
    name: "Manitoba resident draw general elk licence", kind: "DRAW_AUTHORIZATION", provenance: [law("s. 13")], purchase: ONLINE, draw: true,
    prices: [price(67.2, "Elk — Manitoba resident")],
  },
  MB_RESIDENT_LANDOWNER_DRAW_ELK: {
    name: "Manitoba resident landowner draw general elk licence", kind: "DRAW_AUTHORIZATION", provenance: [law("s. 14"), guide("p. 42", "Landowner Draw")], purchase: ONLINE, draw: true,
    prices: [price(67.2, "Elk — Manitoba resident")],
    note: "Valid only on property the licence holder owns (2026 guide, p. 42).",
  },
  MB_RESIDENT_ARCHERY_MOOSE: {
    name: "Manitoba resident archery moose licence", kind: "SPECIES_LICENCE", provenance: [law("s. 17")], purchase: ONLINE,
    prices: [price(61.75, "Moose — Manitoba resident (archery, general)")],
  },
  /* The fee table prints a resident archery/general moose fee and a draw
     application fee, and does not say which a drawn moose licence costs. */
  MB_RESIDENT_DRAW_ARCHERY_MOOSE: {
    name: "Manitoba resident draw archery moose licence", kind: "DRAW_AUTHORIZATION", provenance: [law("Schedule D, Part B")], purchase: ONLINE, draw: true,
    prices: [], feeNote: "The 2026 guide prints a resident archery and general moose fee and a separate draw application fee; it does not say which fee a drawn licence carries.",
  },
  MB_RESIDENT_DRAW_GENERAL_MOOSE: {
    name: "Manitoba resident draw general moose licence", kind: "DRAW_AUTHORIZATION", provenance: [law("s. 18")], purchase: ONLINE, draw: true,
    prices: [], feeNote: "The 2026 guide prints a resident archery and general moose fee and a separate draw application fee; it does not say which fee a drawn licence carries.",
  },
  MB_RESIDENT_GENERAL_MOOSE: {
    name: "Manitoba resident general moose licence", kind: "SPECIES_LICENCE", provenance: [law("s. 19(1)")], purchase: ONLINE,
    prices: [price(61.75, "Moose — Manitoba resident (archery, general)"), price(97.25, "Manitoba resident Conservation Moose Licence Package", "conservation package")],
    note: "The Conservation Moose Licence Package is two licences sharing one game tag (2026 guide, p. 39).",
  },
  CANADIAN_RESIDENT_GENERAL_MOOSE: {
    name: "Canadian resident general moose licence", kind: "SPECIES_LICENCE", provenance: [law("s. 19(2)")], purchase: OUTFITTER,
    prices: [price(319.25, "Moose — Canadian resident")],
  },
  NON_CANADIAN_GENERAL_MOOSE: {
    name: "Non-Canadian resident general moose licence", kind: "SPECIES_LICENCE", provenance: [law("s. 19(3)")], purchase: OUTFITTER,
    prices: [price(380.25, "Moose — Non-Canadian resident")],
  },
  MB_RESIDENT_GENERAL_BLACK_BEAR: {
    name: "Manitoba resident general black bear licence", kind: "SPECIES_LICENCE", provenance: [law("s. 24")], purchase: ONLINE,
    prices: [price(46.2, "Black Bear — Manitoba resident"), price(14.75, "Black Bear — Manitoba resident (youth)", "youth")],
  },
  CANADIAN_RESIDENT_GENERAL_BLACK_BEAR: {
    name: "Canadian resident general black bear licence", kind: "SPECIES_LICENCE", provenance: [law("s. 24")], purchase: ONLINE,
    prices: [price(133, "Black Bear — Canadian resident")],
  },
  NON_CANADIAN_GENERAL_BLACK_BEAR: {
    name: "Non-Canadian resident general black bear licence", kind: "SPECIES_LICENCE", provenance: [law("s. 24")], purchase: OUTFITTER,
    prices: [price(252, "Black Bear — Non-Canadian resident")],
  },
};

const hunterEducation: AuthorizationRecord = {
  id: HUNTER_EDUCATION_ID,
  kind: "HUNTER_EDUCATION",
  officialName: "Manitoba Hunter Education Certificate (or an equivalent from another jurisdiction)",
  authority: AUTHORITY,
  jurisdictionId: "jurisdiction:ca-mb",
  appliesTo: {},
  prerequisites: [],
  possessionVerifiable: false,
  purchase: { channels: ["PHYSICAL_VENDOR", "ONLINE"], phone: "1-877-633-4868", infoUrl: "https://mwf.mb.ca" },
  prices: [],
  provenance: [guide("p. 9", "Licence Requirements; Hunter Qualifications")],
  note: "Every hunter needs one to buy any Manitoba hunting licence, and must carry it while hunting. The Canadian Firearms Safety Course does not meet this requirement.",
};

function recordFor(licence: string): AuthorizationRecord | undefined {
  const spec = LICENCES[licence];
  if (!spec) return undefined;
  return {
    id: `authorization:ca-mb-${licence.toLowerCase().replace(/_/g, "-")}` as AuthorizationRecord["id"],
    kind: spec.kind,
    officialName: spec.name,
    authority: AUTHORITY,
    jurisdictionId: "jurisdiction:ca-mb",
    appliesTo: {},
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    prerequisites: [HUNTER_EDUCATION_ID],
    possessionVerifiable: false,
    purchase: { ...spec.purchase, channels: [...spec.purchase.channels, ...(spec.draw ? ["DRAW" as const] : [])] },
    prices: spec.prices,
    provenance: [...spec.provenance, ...(spec.prices.length ? [fees()] : [])],
    ...(spec.draw
      ? { draw: { required: true, infoUrl: DRAW_INFO, note: "Issued through Manitoba's big game draw; the draw application fee is $11.50 per applicant (2026 guide, p. 7). North Ground cannot see draw results." } }
      : {}),
    ...(spec.note || spec.feeNote ? { note: [spec.note, spec.feeNote].filter(Boolean).join(" ") } : {}),
  };
}

/* ── Hunter orange, M.R. 351/87 s. 10 ────────────────────────────────────── */

const ORANGE_SPECIFICATION =
  "A head covering completely hunter orange (other than the brim of a hat) and at least 2,580 cm² (400 in²) of hunter orange " +
  "material above the waist, visible from all sides, not covered in any way.";
const ORANGE_EXCEPTIONS = [
  "Registered trappers, and trappers in an open trapping area, hunting black bear, coyote or gray wolf during that animal's trapping season (s. 10(2)(b), (f)).",
  "A person hunting coyote or gray wolf where no other big game season is open (s. 10(2)(d)).",
];

/**
 * Orange follows the conditions the regulatory answer already carries, so the
 * checklist and the answer cannot disagree: each of them is M.R. 351/87 s. 10
 * read for this hunt's species, place and date.
 */
function manitobaOrange(speciesId: string, date: string, regulation: RegulatoryResult): OrangeResult {
  const ids = new Set((regulation.conditions ?? []).map((condition) => condition.id));
  if (ids.has("ca-mb-big-game-hunter-orange") || ids.has("ca-mb-bear-hunter-orange-after-june")) {
    return {
      status: "REQUIRED", summary: "Required: big game hunters must wear hunter orange.", specification: ORANGE_SPECIFICATION,
      exceptions: ORANGE_EXCEPTIONS, provenance: [generalLaw("s. 10(1)")],
    };
  }
  if (ids.has("ca-mb-upland-hunter-orange")) {
    return {
      status: "REQUIRED", summary: "Required: the general deer season is open here on this date, so upland game bird hunters must wear hunter orange.",
      specification: ORANGE_SPECIFICATION, exceptions: [], provenance: [generalLaw("s. 10(3)")],
    };
  }
  if (ids.has("ca-mb-archery-no-hunter-orange-exemption-note")) {
    return {
      status: "NOT_REQUIRED", summary: "Not required: archers hunting during an archery season are exempt.",
      exceptions: [], provenance: [generalLaw("s. 10(2)(a)")],
    };
  }
  if (speciesId === "species:american-black-bear" && date.slice(5) >= "04-01" && date.slice(5) <= "06-30") {
    return {
      status: "NOT_REQUIRED", summary: "Not required: a person hunting black bears from April 1 to June 30 is exempt.",
      exceptions: [], provenance: [generalLaw("s. 10(2)(c)")],
    };
  }
  if (["species:ruffed-grouse", "species:spruce-grouse", "species:sharp-tailed-grouse"].includes(speciesId)) {
    return {
      status: "NOT_REQUIRED", summary: "Not required: upland game bird hunters must wear orange only during the general deer season, which is not open here on this date.",
      exceptions: [], provenance: [generalLaw("s. 10(3)")],
    };
  }
  return {
    status: "NOT_CERTIFIED", summary: "North Ground has not established whether hunter orange is required for this hunt.",
    exceptions: [], provenance: [],
  };
}

/* ── Legal methods ───────────────────────────────────────────────────────── */

const ALL_EQUIPMENT = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"] as const;

/**
 * Only where the licence's own name settles the equipment. "Archery" is a bow
 * and not a crossbow (s. 3.3), except under a disabled crossbow permit
 * (s. 29.1); "general" is all equipment for elk and moose (s. 3.2(1)) but not
 * for deer or bear licences (s. 3.2(2)), whose seasons state equipment row by
 * row — the answer above already applied that to the method chosen.
 */
function manitobaMethods(licence: string | undefined): ReadinessResult["methods"] | undefined {
  if (!licence) return undefined;
  const archery = /ARCHERY/.test(licence);
  const generalBigGame = /_(ELK|MOOSE)$/.test(licence) && !archery;
  if (archery) {
    const allowed: LegalMethod[] = [{ method: "BOW", status: "ALLOWED", restriction: "Long, recurved or compound bow.", provenance: [law("s. 3.3")] }];
    const crossbow: LegalMethod = {
      method: "CROSSBOW", status: "CONDITIONAL", restriction: "Only with a disabled crossbow permit.", provenance: [law("s. 29.1")],
    };
    return { allowed: [...allowed, crossbow], notAllowed: [], recommended: [] };
  }
  if (generalBigGame) {
    return {
      allowed: ALL_EQUIPMENT.map((method) => ({ method, status: "ALLOWED" as const, provenance: [law("s. 3.2(1)")] })),
      notAllowed: [],
      recommended: [],
    };
  }
  return undefined;
}

/* ── The checklist ───────────────────────────────────────────────────────── */

export function resolveManitobaReadiness(
  input: { speciesId: string; date: string; zoneId: string; answers: HunterAnswers; regulation?: RegulatoryResult },
): ReadinessResult {
  const base = { jurisdictionName: "Manitoba", officialInfoUrl: ELICENSING };
  const licence = input.answers.LICENCE_TYPE;
  const record = licence ? recordFor(licence) : undefined;
  const records = new Map<string, AuthorizationRecord>([[hunterEducation.id, hunterEducation], ...(record ? [[record.id, record] as const] : [])]);
  const requirements: AuthorizationRequirement[] = [
    { authorizationId: hunterEducation.id, provenance: hunterEducation.provenance },
    ...(record ? [{ authorizationId: record.id, provenance: record.provenance }] : []),
  ];
  const month = Number(input.date.slice(5, 7));
  const authorizations = resolveAuthorizations(requirements, records, {
    answers: input.answers,
    /* The hunting year begins on 1 April (M.R. 165/91 s. 1). */
    licenceYearToday: Number(input.date.slice(0, 4)) - (month < 4 ? 1 : 0),
  });
  const methods = manitobaMethods(licence);
  return {
    ...base,
    coverage: "PARTIAL",
    authorizations,
    requirements: authorizationRows(authorizations, ELICENSING),
    ...(input.regulation ? { orange: manitobaOrange(input.speciesId, input.date, input.regulation) } : {}),
    ...(methods ? { methods } : {}),
    limitations: [
      ...(record ? [] : ["North Ground has not resolved which licence this hunt needs. Choose the licence you will hunt under to see it here."]),
      ...(methods ? [] : ["Legal equipment for this licence is set season by season in M.R. 165/91 Schedules A, B, B.1 and F; the answer above already reflects the method you chose."]),
      "Ammunition rules, the federal firearms licence and party-hunting rules are not yet listed here. Check the current official rules before you go.",
      "Fees are as published from April 1, 2026, and are subject to change. North Ground cannot verify which licences, tags or certificates you hold.",
    ],
  };
}
