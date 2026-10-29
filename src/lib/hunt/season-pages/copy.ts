import { longDayLabel } from "../exploration/date-presets.ts";
import { EXPLORATION_WORDING, type ExplorationState } from "../exploration/states.ts";
import { readableCalendarDay } from "../date.ts";
import type { OpportunityWindow } from "../regulatory/opportunity-row.ts";
import type { RegionPage, RegionSpeciesSummary, SpeciesSeasonPage, ZoneAnswer } from "./seasons.ts";

/**
 * The sentences a season page says, as data, so the visible answer and the
 * FAQPage JSON-LD are one string and a test can read exactly what a crawler
 * reads.
 *
 * Nothing here decides anything. It counts what `seasons.ts` already carries
 * and words it with the map's own vocabulary (`EXPLORATION_WORDING`), so a
 * page cannot describe a zone more confidently than the zone card does. Every
 * answer is dated, because every answer is about one day.
 */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** The order states are spoken in: what is running first, absences last. */
const STATE_ORDER: ExplorationState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN", "NOT_CERTIFIED"];

export function dayLabel(iso: string): string {
  return longDayLabel(iso);
}

/** A window's two ends as a reader sees them: "Sep 15" and "Dec 31, 2026", with both years where it crosses one. */
export function windowParts(window: Pick<OpportunityWindow, "opens" | "closes">): { opens: string; closes: string } {
  const opens = readableCalendarDay(window.opens) ?? window.opens;
  const closes = readableCalendarDay(window.closes) ?? window.closes;
  const sameYear = window.opens.slice(0, 4) === window.closes.slice(0, 4);
  return { opens: sameYear ? opens.replace(/,\s*\d{4}$/, "") : opens, closes };
}

/** "Sep 15 – Dec 31, 2026". */
export function windowLabel(window: Pick<OpportunityWindow, "opens" | "closes">): string {
  const { opens, closes } = windowParts(window);
  return `${opens} – ${closes}`;
}

/** "Sep 15, 2026". */
export function calendarDay(iso: string): string {
  return readableCalendarDay(iso) ?? iso;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Lower-case species names inside a sentence, keeping proper nouns ("American black bear"). */
export function inSentence(name: string): string {
  const [first, ...rest] = name.split(" ");
  const keep = /^[A-Z][a-z]+an$|^[A-Z]{2,}/.test(first) || ["American", "Canada", "Arctic", "Eastern", "Gray", "Dall's", "Stone's", "Richardson's"].includes(first);
  return [keep ? first : first.toLowerCase(), ...rest].join(" ");
}

/** "In season 98 · Closed 5 · Not covered here 47", in the map's words. */
export function stateBreakdown(counts: Record<ExplorationState, number>): Array<{ state: ExplorationState; label: string; count: number }> {
  return STATE_ORDER
    .filter((state) => counts[state] > 0)
    .map((state) => ({ state, label: EXPLORATION_WORDING[state].label, count: counts[state] }));
}

function breakdownSentence(counts: Record<ExplorationState, number>): string {
  return stateBreakdown(counts).map(({ label, count }) => `${label.toLowerCase()} in ${count}`).join(", ");
}

/** Up to `max` zone labels, then a count of the rest. */
export function zoneList(zones: readonly Pick<ZoneAnswer, "fullLabel">[], max = 8): string {
  const names = zones.map((zone) => zone.fullLabel);
  if (names.length <= max) return joinWords(names);
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** "2026" or "2026–27": the years the certified windows on the page span. */
export function seasonYears(page: Pick<SpeciesSeasonPage, "groups" | "date">): string {
  const windows = page.groups.flatMap((group) => group.rows.flatMap((row) => row.windows));
  const years = windows.flatMap((window) => [window.opens.slice(0, 4), window.closes.slice(0, 4)]).filter((year) => /^\d{4}$/.test(year)).sort();
  const first = years[0] ?? page.date.slice(0, 4);
  const last = years.at(-1) ?? first;
  return first === last ? first : `${first}–${last.slice(2)}`;
}

/* ── Species × region ─────────────────────────────────────────────────── */

export function unitsPhrase(page: Pick<SpeciesSeasonPage, "zones" | "layer" | "region">): string {
  return `${page.zones.length} ${page.region.name} ${page.zones.length === 1 ? page.layer.officialTerm : page.layer.officialTermPlural}`;
}

/** The answer a hunter asked for, in two or three sentences, dated. */
export function speciesDirectAnswer(page: SpeciesSeasonPage): string {
  const day = dayLabel(page.date);
  const name = inSentence(page.name);
  const sentences: string[] = [];
  if (page.opportunityZones > 0) {
    sentences.push(
      `As of ${day}, a ${name} season is running in ${page.opportunityZones} of the ${unitsPhrase(page)} North Ground evaluates, under the rules it has certified from the official regulations.`,
    );
    const depends = page.counts.CHECK_REQUIREMENTS;
    if (depends > 0) {
      sentences.push(`In ${depends === 1 ? "one unit" : `${depends} units`}, whether a season is open to you depends on your hunt — licence, residency, tag or method.`);
    }
  } else {
    sentences.push(`As of ${day}, no ${name} season is running in any of the ${unitsPhrase(page)} North Ground evaluates, under the rules it has certified.`);
  }
  const rest = breakdownSentence(page.counts);
  if (rest) sentences.push(`By unit: ${rest}.`);
  if (page.counts.UNKNOWN > 0) sentences.push(`"${EXPLORATION_WORDING.UNKNOWN.label}" is a gap in North Ground's coverage, not a closed season.`);
  if (page.opportunityZones === 0 && page.nextOpening) {
    sentences.push(`The next certified season opens ${calendarDay(page.nextOpening.opens)} in ${zoneList(page.nextOpening.zones, 4)}.`);
  }
  return sentences.join(" ");
}

export function speciesFaq(page: SpeciesSeasonPage): FaqItem[] {
  const name = inSentence(page.name);
  const day = dayLabel(page.date);
  const faq: FaqItem[] = [{
    id: "open-now",
    question: `Is ${name} season open in ${page.region.name} right now?`,
    answer: `${speciesDirectAnswer(page)} A running season is not a licence: licensing, legal hunting hours and local restrictions still apply.`,
  }];
  if (page.runningSeasonCloses) {
    const { earliest, latest } = page.runningSeasonCloses;
    faq.push({
      id: "closes",
      question: `When does ${name} season close in ${page.region.name}?`,
      answer: earliest === latest
        ? `The ${name} seasons running on ${day} close on ${calendarDay(latest)} in every unit where one is running. Later seasons, where certified, are listed by unit on this page.`
        : `The ${name} seasons running on ${day} close between ${calendarDay(earliest)} and ${calendarDay(latest)}, depending on the ${page.layer.officialTerm}. Each unit's dates are listed on this page.`,
    });
  }
  if (page.nextOpening) {
    faq.push({
      id: "next",
      question: `When does the next ${name} season open in ${page.region.name}?`,
      answer: `After ${day}, the next certified ${name} season opens ${calendarDay(page.nextOpening.opens)} and runs to ${calendarDay(page.nextOpening.closes)} in ${zoneList(page.nextOpening.zones, 6)}.`,
    });
  }
  faq.push({
    id: "zones",
    question: `How are ${name} seasons set in ${page.region.name}?`,
    answer: `${page.layer.authority} sets them by ${page.layer.officialTerm}. North Ground evaluates ${page.zones.length} of them${page.officialUnits && page.officialUnits > page.zones.length ? ` (the authority publishes ${page.officialUnits})` : ""}. This page lists what the certified rules state for each of them.`,
  });
  if (page.sources.length) {
    faq.push({
      id: "sources",
      question: `Where do these ${name} season dates come from?`,
      answer: `From ${joinWords(page.sources.map((source) => source.title))}${page.verifiedAt ? `, last verified by North Ground on ${calendarDay(page.verifiedAt)}` : ""}. The authority's own regulations are the law; confirm with them before you hunt.`,
    });
  }
  return faq;
}

export function speciesMetaTitle(page: SpeciesSeasonPage): string {
  return `${page.name} Season in ${page.region.name} (${seasonYears(page)}): Dates by ${page.layer.officialTerm}`;
}

export function speciesMetaDescription(page: SpeciesSeasonPage): string {
  const name = inSentence(page.name);
  return `Is ${name} in season in ${page.region.name} today? Season status and certified dates for ${unitsPhrase(page)}, from the official regulations, with sources. Updated daily.`;
}

/* ── Region ───────────────────────────────────────────────────────────── */

export function runningSpecies(page: RegionPage): RegionSpeciesSummary[] {
  return page.species.filter((species) => species.opportunityZones > 0);
}

export function regionDirectAnswer(page: RegionPage): string {
  const day = dayLabel(page.date);
  const running = runningSpecies(page);
  const certified = plural(page.species.length, "species", "species");
  if (!running.length) {
    return `As of ${day}, none of the ${certified} North Ground certifies in ${page.region.name} has a season running in any unit it evaluates.`;
  }
  const terms = [...new Set(page.species.map((species) => species.term))];
  const list = running.map((species) => `${inSentence(species.name)} (${species.opportunityZones} of ${species.zoneCount})`);
  return `As of ${day}, North Ground's certified rules show a season running in at least one of ${page.region.name}'s ${joinWords(terms)} for ${joinWords(list)}. North Ground certifies ${certified} here; anything else is not covered on this page, which is not the same as closed.`;
}

export function regionFaq(page: RegionPage): FaqItem[] {
  const layers = page.layers.map((layer) => `${layer.officialTermPlural} (${layer.zones})`);
  const authorities = [...new Set(page.layers.map((layer) => layer.authority))];
  const faq: FaqItem[] = [
    {
      id: "open-now",
      question: `What can I hunt in ${page.region.name} right now?`,
      answer: `${regionDirectAnswer(page)} Whether a running season is open to you still depends on your licence, residency and method, and federal migratory game bird seasons are not listed here.`,
    },
    {
      id: "zones",
      question: `What hunting zones does ${page.region.name} use?`,
      answer: `${joinWords(authorities)} ${authorities.length === 1 ? "sets" : "set"} seasons by ${joinWords(layers)}. North Ground Hunt draws the authority's own boundaries; use your location or search a place there to find the unit you are in.`,
    },
  ];
  if (page.verifiedAt) {
    faq.push({
      id: "current",
      question: `How current is this ${page.region.name} season information?`,
      answer: `The status is recomputed for each day from North Ground's certified rules, which were last verified against the official sources on ${calendarDay(page.verifiedAt)}. The authority's own regulations are the law.`,
    });
  }
  return faq;
}

export function regionMetaTitle(page: RegionPage): string {
  const term = page.layers[0]?.officialTerm ?? "Zone";
  return `${page.region.name} Hunting Seasons Today: What's Open by ${term}`;
}

export function regionMetaDescription(page: RegionPage): string {
  const units = page.layers.reduce((total, layer) => total + layer.zones, 0);
  return `What is in season in ${page.region.name} today? Certified season status and dates for ${plural(page.species.length, "species", "species")} across ${units} official hunting zones, with sources. Updated daily.`;
}
