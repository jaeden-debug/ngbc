import { jurisdictionTodayIso } from "../date.ts";
import { majorGameImplementBasis, majorGameImplementsOnDate, majorGameSeasonsInUnit } from "../regulatory/major-game.ts";
import { evaluateSeason, parseSeasonPhrase } from "../regulatory/season.ts";
import { METHOD_LABELS } from "./format.ts";
import { resolveAuthorizations, type HunterAnswers } from "./resolve.ts";
import type {
  AmmunitionRestriction, AuthorizationRecord, LegalMethod, MethodClass, OrangeResult, Provenance,
  ReadinessResult, Recommendation,
} from "./types.ts";
import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };

/**
 * Ontario's Ready to Hunt.
 *
 * Every legal statement comes from `ca-on-2026.json`, whose builder re-read each
 * quoted sentence in O. Reg. 665/98 or the 2026 summary before writing it. What
 * lives here is only the reasoning that joins those facts to one hunt — chiefly
 * hunter orange, which in Ontario depends on OTHER species' seasons: a grouse
 * hunter wears orange because a deer gun season or the elk season is open in
 * the unit, not because of anything about grouse.
 */

const TIME_ZONE = "America/Toronto";
const DEER = "species:white-tailed-deer";
const MOOSE = "species:moose";
const ELK = "species:elk";
const BEAR = "species:american-black-bear";
const TURKEY = "species:wild-turkey";

type Record_ = AuthorizationRecord & { residencyNotes?: Record<string, { text: string; provenance: Provenance }> };

const RECORDS = new Map<string, Record_>(
  (bundle.authorizations as unknown as Record_[]).map((record) => [record.id, record]),
);
const REQUIREMENTS = bundle.requirements as unknown as Record<string, Parameters<typeof resolveAuthorizations>[0]>;
const SPECIES_METHODS = bundle.speciesMethods as Record<
  string,
  { methods: string; ammunition: string[]; recommendations?: string; smallGame?: boolean }
>;
const METHODS = bundle.methods as unknown as Record<
  string,
  { allowed: Record<string, { restriction?: string; provenance: Provenance[] }>; notAllowed: Record<string, Provenance[]> }
>;
const AMMUNITION = bundle.ammunition as unknown as Record<
  string,
  { status?: "REQUIRED" | "CONDITIONAL"; appliesToMethods: MethodClass[]; summary: string; provenance: Provenance[] }
>;
const RECOMMENDATIONS = bundle.recommendations as unknown as Record<string, Omit<Recommendation, "layer">[]>;
const ORANGE = bundle.orange as unknown as { specification: string; provenance: Record<string, Provenance> };

interface Overlapping {
  speciesId: string;
  kind: "GENERAL" | "CONTROLLED";
  huntCode?: string;
  zoneIds: string[];
  seasonPhrase: string;
  bowsOnly: boolean;
}
const OVERLAPPING = bundle.overlappingSeasons as Overlapping[];

export const ONTARIO_READINESS_SPECIES: readonly string[] = Object.keys(REQUIREMENTS).sort();

/* ── Which seasons are open in the unit ──────────────────────────────────── */

interface OpenSeason {
  speciesId: string;
  label: string;
  bowsOnly: boolean;
}

/**
 * Every deer, moose, elk and bear season open in a unit on a date — general
 * seasons from the certified bundle, elk and controlled hunts from the readiness
 * bundle. A season that cannot be placed on the date makes the whole answer
 * uncertain rather than silently absent.
 */
function openSeasonsInUnit(zoneId: string, date: string): { open: OpenSeason[]; uncertain: boolean } {
  const general = majorGameSeasonsInUnit(zoneId, date);
  const open: OpenSeason[] = general.open.map((season) => ({
    speciesId: season.speciesId,
    label: `${speciesName(season.speciesId)} ${season.seasonLabel}`,
    bowsOnly: season.bowsOnly,
  }));
  let uncertain = general.uncertain;
  for (const season of OVERLAPPING) {
    if (!season.zoneIds.includes(zoneId)) continue;
    const windows = parseSeasonPhrase(season.seasonPhrase);
    if (!windows) { uncertain = true; continue; }
    const { verdict } = evaluateSeason(windows, bundle.licenceYear, date);
    if (verdict === "OUTSIDE_CERTIFIED_PERIOD") uncertain = true;
    if (verdict !== "IN_SEASON") continue;
    open.push({
      speciesId: season.speciesId,
      label: season.kind === "CONTROLLED"
        ? `a controlled ${speciesName(season.speciesId)} hunt${season.huntCode ? ` (hunt code ${season.huntCode})` : ""}`
        : `the ${speciesName(season.speciesId)} season`,
      bowsOnly: season.bowsOnly,
    });
  }
  return { open, uncertain };
}

function speciesName(id: string): string {
  return { [DEER]: "deer", [MOOSE]: "moose", [ELK]: "elk", [BEAR]: "bear" }[id] ?? id.replace("species:", "");
}

/* ── Hunter orange, O. Reg. 665/98 s. 26 ─────────────────────────────────── */

/**
 * s. 26(1)(a): orange during any open deer, elk or moose season "other than the
 * seasons restricted to the use of bows only" — muzzle-loader seasons included,
 * which the summary's phrase "gun season" obscures. s. 26(1)(b): also during bear
 * season, except (4) small-game hunters, bows-only deer/moose/elk hunters in a
 * season concurrent with bear, and a bear hunter in a tree stand.
 */
export function ontarioOrange(speciesId: string, zoneId: string, date: string): OrangeResult {
  const { open, uncertain } = openSeasonsInUnit(zoneId, date);
  const p = ORANGE.provenance;
  const specification = ORANGE.specification;
  const nonBow = open.filter((season) => [DEER, MOOSE, ELK].includes(season.speciesId) && !season.bowsOnly);
  const bearOpen = open.some((season) => season.speciesId === BEAR);
  const smallGame = Boolean(SPECIES_METHODS[speciesId]?.smallGame);

  if (nonBow.length) {
    const named = [...new Set(nonBow.map((season) => season.label))];
    return {
      status: "REQUIRED",
      summary: `Required: ${named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`} ${named.length === 1 ? "is" : "are"} open here on this date.`,
      specification,
      exceptions: [],
      provenance: [p.wear, p.bigGame, p.garment, p.camouflage],
    };
  }
  if (uncertain) {
    return {
      status: "CONDITIONAL",
      summary:
        "Required whenever a deer, elk or moose season other than bows-only is open here. North Ground cannot confirm whether one is open on this date.",
      specification,
      exceptions: [],
      provenance: [p.wear, p.bigGame, p.garment],
    };
  }
  if (speciesId === BEAR && bearOpen) {
    return {
      status: "CONDITIONAL",
      summary: "Required while hunting bear, except while you are in a tree stand.",
      specification,
      exceptions: ["While in a tree stand hunting bear."],
      provenance: [p.wear, p.bear, p.treeStand, p.garment],
    };
  }
  if (bearOpen && smallGame) {
    return {
      status: "NOT_REQUIRED",
      summary: "Not required: no deer, elk or moose season other than bows-only is open here, and small-game hunters are exempt during bear season.",
      exceptions: [],
      provenance: [p.bigGame, p.smallGameExempt],
    };
  }
  if (bearOpen && (speciesId === DEER || speciesId === MOOSE)) {
    return {
      status: "NOT_REQUIRED",
      summary: "Not required: only bows-only seasons are open here, which the law exempts even during bear season.",
      exceptions: [],
      provenance: [p.bigGame, p.bowsConcurrent],
    };
  }
  return {
    status: "NOT_REQUIRED",
    summary: "Not required here on this date: no deer, elk or moose season other than bows-only is open, and it is not bear season.",
    exceptions: [],
    provenance: [p.bigGame, p.bear],
  };
}

/* ── Methods and ammunition ──────────────────────────────────────────────── */

const ENGINE_TO_CLASSES: Record<string, MethodClass[]> = {
  RIFLE: ["RIFLE"], SHOTGUN: ["SHOTGUN"], MUZZLELOADER: ["MUZZLELOADER"], BOW: ["BOW", "CROSSBOW"],
};
const METHOD_ORDER: MethodClass[] = ["SHOTGUN", "RIFLE", "MUZZLELOADER", "BOW", "CROSSBOW", "AIR_GUN"];

function legalMethodsHere(speciesId: string, zoneId: string, date: string, answers: HunterAnswers): MethodClass[] {
  const group = SPECIES_METHODS[speciesId];
  const table = METHODS[group.methods];
  const tableMethods = Object.keys(table.allowed) as MethodClass[];
  // Small game other than turkey has no season-by-implement tables: the general
  // small-game firearms rules apply.
  if (group.smallGame && speciesId !== TURKEY) return METHOD_ORDER.filter((method) => tableMethods.includes(method));
  const engine = majorGameImplementsOnDate(speciesId, zoneId, date, answers).flatMap((implement) => ENGINE_TO_CLASSES[implement] ?? []);
  return METHOD_ORDER.filter((method) => engine.includes(method) && tableMethods.includes(method));
}

export function ontarioMethodsAndAmmunition(
  speciesId: string,
  zoneId: string,
  date: string,
  answers: HunterAnswers,
): Pick<ReadinessResult, "methods" | "ammunition"> {
  const group = SPECIES_METHODS[speciesId];
  const table = METHODS[group.methods];
  const legal = legalMethodsHere(speciesId, zoneId, date, answers);

  // For small game, an open big-game season restricts the rifle itself, so the
  // restriction is stated on the rifle rather than left for the reader to join.
  const openBigGame = group.smallGame && speciesId !== TURKEY
    ? openSeasonsInUnit(zoneId, date)
    : { open: [] as OpenSeason[], uncertain: false };
  const bigGameOpen = openBigGame.open.filter((season) => [DEER, MOOSE, ELK, BEAR].includes(season.speciesId));
  const rifleRule = AMMUNITION.smallGameRifleDuringBigGame;

  const allowed: LegalMethod[] = legal.map((method) => {
    if (method === "RIFLE" && (bigGameOpen.length || openBigGame.uncertain)) {
      const inForce = bigGameOpen.length > 0 && !bigGameOpen.every((season) => season.speciesId === DEER && season.bowsOnly);
      // When the restriction is in force today, say so, and why — the hunter
      // should not have to work out that "a big game season" means this one.
      const today = inForce ? `In force today: ${[...new Set(bigGameOpen.map((season) => season.label))].join(" and ")} open here. ` : "";
      return {
        method,
        status: inForce ? "ALLOWED" : "CONDITIONAL",
        restriction: `${today}${rifleRule.summary}`,
        provenance: rifleRule.provenance,
      };
    }
    return {
      method,
      status: "ALLOWED",
      ...(table.allowed[method]?.restriction ? { restriction: table.allowed[method].restriction } : {}),
      provenance: table.allowed[method]?.provenance ?? [],
    };
  });

  /* What the law rules out for THIS hunt — and only what the law rules out.
     There is no hardcoded list of methods to take a complement against, because
     a complement is what produced a false claim here: every standard method
     missing from `legal` was asserted prohibited, so a unit North Ground held
     no rules for answered "Not allowed: Rifle, Shotgun, Muzzleloader, Bow"
     with no source behind any of it. A method is ruled out only when we can
     say who ruled it out. */
  const basis = group.smallGame && speciesId !== TURKEY
    ? undefined
    : majorGameImplementBasis(speciesId, zoneId, date, answers);
  const seasonProvenance: Provenance[] = (basis?.sources ?? []).map((source) => ({
    sourceId: source.sourceId,
    url: source.url,
    citation: `${source.title} (${source.sourceVersion})`,
    tier: "OFFICIAL_SUMMARY" as const,
    retrievedAt: bundle.retrievedAt as string,
  }));

  /* The methods the SOURCE speaks about — both the ones it permits and the
     ones it names as not permitted. Iterating only the permitted ones would
     drop a prohibition the summary states outright: Ontario's turkey table
     names the rifle as not permitted and never lists it as allowed. */
  const spokenAbout = [...new Set([...Object.keys(table.allowed), ...Object.keys(table.notAllowed)])] as MethodClass[];

  const notAllowed: LegalMethod[] = spokenAbout
    .filter((method) => !legal.includes(method))
    .map((method): LegalMethod | undefined => {
      // 1. The summary names this implement as not permitted for this species.
      const stated = table.notAllowed[method];
      if (stated?.length) {
        return { method, status: "PROHIBITED", restriction: `${METHOD_LABELS[method]} may not be used for this species.`, provenance: stated };
      }
      /* 2. The seasons themselves rule it out: this species' seasons in this
         unit are certified, they are published by implement, and none open on
         this date admits this one. That is a statement the season records
         support, so it carries them. */
      if (basis?.certified && seasonProvenance.length) {
        return { method, status: "PROHIBITED", restriction: `No season open here on this date permits ${METHOD_LABELS[method].toLowerCase()}.`, provenance: seasonProvenance };
      }
      // 3. Nothing supports it. Say nothing: silence is not prohibition.
      return undefined;
    })
    .filter((entry): entry is LegalMethod => entry !== undefined);

  const required: AmmunitionRestriction[] = group.ammunition
    .map((key) => AMMUNITION[key])
    .filter((entry) => entry.appliesToMethods.some((method) => legal.includes(method)))
    .map((entry) => ({ status: entry.status ?? "REQUIRED", appliesToMethods: entry.appliesToMethods, summary: entry.summary, provenance: entry.provenance }));

  if (group.smallGame && speciesId !== TURKEY) {
    const { uncertain } = openBigGame;
    const bigGame = bigGameOpen;
    const entry = AMMUNITION.smallGameDuringBigGame;
    if (bigGame.length) {
      // The only published exception needs geography North Ground does not hold:
      // south of the French and Mattawa rivers during a bows-only deer season.
      const onlyBowsOnlyDeer = bigGame.every((season) => season.speciesId === DEER && season.bowsOnly);
      required.push({
        status: onlyBowsOnlyDeer ? "CONDITIONAL" : "REQUIRED",
        appliesToMethods: entry.appliesToMethods,
        summary: onlyBowsOnlyDeer
          ? `${entry.summary} Applies north of the French and Mattawa rivers while only a bows-only deer season is open.`
          : entry.summary,
        provenance: entry.provenance,
      });
    } else if (uncertain) {
      required.push({ status: "CONDITIONAL", appliesToMethods: entry.appliesToMethods, summary: entry.summary, provenance: entry.provenance });
    }
    if (legal.includes("RIFLE")) {
      const calibre = AMMUNITION.southernRifleCalibre;
      required.push({ status: "CONDITIONAL", appliesToMethods: calibre.appliesToMethods, summary: calibre.summary, provenance: calibre.provenance });
    }
  }

  const chosen = answers.HUNT_METHOD ? ENGINE_TO_CLASSES[answers.HUNT_METHOD] ?? [] : legal;
  const advice = (RECOMMENDATIONS[group.recommendations ?? ""] ?? [])
    .filter((entry) => entry.appliesToMethods.some((method) => legal.includes(method) && chosen.includes(method)))
    .map((entry): Recommendation => ({
      layer: "NORTH_GROUND_KNOWLEDGE",
      topic: entry.topic,
      appliesToMethods: entry.appliesToMethods,
      text: entry.text,
      ...(entry.withinLegal ? { withinLegal: entry.withinLegal } : {}),
    }));

  return {
    methods: { allowed, notAllowed, recommended: advice.filter((entry) => entry.topic === "WEAPON") },
    ammunition: { required, recommended: advice.filter((entry) => entry.topic === "AMMUNITION") },
  };
}

/* ── The checklist ───────────────────────────────────────────────────────── */

/** Which turkey tag the hunt date calls for — decided by the season, never asked. */
function turkeySeasonVariant(zoneId: string, date: string): string | undefined {
  const open = majorGameSeasonsInUnit(zoneId, date).open.find((season) => season.speciesId === TURKEY);
  if (!open) return undefined;
  return open.seasonLabel.startsWith("spring") ? "spring" : "fall";
}

export function resolveOntarioReadiness(
  input: { speciesId: string; date: string; zoneId: string; answers: HunterAnswers },
  now: Date = new Date(),
): ReadinessResult {
  const requirements = REQUIREMENTS[input.speciesId];
  const base = {
    jurisdictionName: bundle.jurisdictionName,
    officialInfoUrl: bundle.officialInfoUrl,
  };
  if (!requirements) {
    return {
      ...base,
      coverage: "UNAVAILABLE",
      authorizations: [],
      limitations: ["North Ground has not built a Ready to Hunt checklist for this species in Ontario yet."],
    };
  }

  const licenceYearToday = Number(jurisdictionTodayIso(TIME_ZONE, now).slice(0, 4));
  const authorizations = resolveAuthorizations(requirements, RECORDS, {
    answers: input.answers,
    licenceYearToday,
    seasonVariant: input.speciesId === TURKEY ? turkeySeasonVariant(input.zoneId, input.date) : undefined,
  });
  const vendorDirectory = authorizations
    .map((item) => item.purchase?.vendorDirectoryId)
    .find((id): id is string => Boolean(id));

  return {
    ...base,
    coverage: "VERIFIED",
    authorizations,
    orange: ontarioOrange(input.speciesId, input.zoneId, input.date),
    ...ontarioMethodsAndAmmunition(input.speciesId, input.zoneId, input.date, input.answers),
    ...(vendorDirectory
      ? { vendorSearch: { directoryId: vendorDirectory, attribution: "Contains information licensed under the Open Government Licence – Ontario." } }
      : {}),
    limitations: [
      `Fees are Ontario's published ${bundle.licenceYear} fees before 13% HST. North Ground does not sell licences.`,
      "North Ground cannot check what you hold. Carry your Outdoors Card and licence summary while hunting.",
    ],
  };
}
