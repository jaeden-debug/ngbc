#!/usr/bin/env node
/**
 * Build the federal migratory-game-bird bundle from the regulation itself.
 *
 *   node scripts/build-federal-migratory-regulations.mjs [--check]
 *
 * Source: Migratory Birds Regulations, 2022 (SOR/2022-105), Schedule 3, which
 * s. 28(1) binds to directly. Not the annual summary, and NOT Environment and
 * Climate Change Canada's district layer, which is published as Draft with no
 * legal value.
 *
 * WAVE 1 covers the jurisdictions whose federal areas resolve without any new
 * geometry, because the regulation defines them over geography North Ground
 * already holds:
 *
 *   Prince Edward Island  "Throughout Prince Edward Island" — the province,
 *                         which is its whole hunting geography.
 *   Yukon                 latitude bands, computed exactly from the point.
 *   Alberta               explicit Provincial Wildlife Management Unit lists,
 *                         every one checked against the certified inventory.
 *
 * Everything this cannot read EXACTLY is refused into `notEncoded` with the
 * regulation's own words. That includes residency-varying limits, seasons
 * narrowed to a sub-list of units, and bag limits that change inside a window.
 * A bundle that guessed any of those would answer confidently and wrongly.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  MBR_CITATION, MBR_URL, cellItems, cellText, partHtml, partTables, scheduleThree, sha256,
} from "./federal-migratory-source.mjs";
import { federalGroupFor, isRepealedRow } from "../src/lib/hunt/regulatory/federal-groups.ts";

const BUNDLE = "content/regulatory/ca-federal-2026.json";
const CACHE = "/tmp/mbr2022.html";

const WAVE_1 = [
  { part: 2, name: "Prince Edward Island", jurisdictionId: "jurisdiction:ca-pe" },
  { part: 12, name: "Yukon", jurisdictionId: "jurisdiction:ca-yt" },
  { part: 9, name: "Alberta", jurisdictionId: "jurisdiction:ca-ab" },
];

const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

/** "October 1 to January 15" -> {from:{month,day}, to:{month,day}}, or null. */
function readWindow(text) {
  const match = /^([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})$/.exec(text.trim());
  if (!match) return null;
  const [, fromMonth, fromDay, toMonth, toDay] = match;
  if (!MONTHS[fromMonth] || !MONTHS[toMonth]) return null;
  return {
    from: { month: MONTHS[fromMonth], day: Number(fromDay) },
    to: { month: MONTHS[toMonth], day: Number(toDay) },
    /* A window whose end month precedes its start crosses the new year. */
    crossesYear: MONTHS[toMonth] < MONTHS[fromMonth],
    statedAs: text.trim(),
  };
}

/** A plain integer limit, or null where the cell says anything else. */
function readLimit(text) {
  const value = text.trim();
  if (/^No limit$/i.test(value)) return { kind: "NO_LIMIT", statedAs: value };
  if (/^N\/A$/i.test(value)) return { kind: "NOT_APPLICABLE", statedAs: value };
  const plain = /^(\d+)$/.exec(value);
  if (plain) return { kind: "COUNT", count: Number(plain[1]), statedAs: value };
  const withSub = /^(\d+)\s*\((.+)\)$/.exec(value);
  if (withSub) return { kind: "COUNT", count: Number(withSub[1]), subLimit: withSub[2], statedAs: value };
  return null;
}

const stripLabel = (text) => text.replace(/^\((?:[a-z]+|[ivx]+|[A-Z])\)\s*/, "").trim();

function main() {
  const html = readFileSync(CACHE, "utf8");
  const documentHash = sha256(html);
  const schedule = scheduleThree(html);

  const rules = [];
  const notEncoded = [];
  let considered = 0;

  for (const { part, name, jurisdictionId } of WAVE_1) {
    const tables = partTables(partHtml(schedule, part, name));
    for (const table of tables) {
      const isTable1 = /TABLE 1/.test(table.caption);
      for (const row of table.grid) {
        const item = cellText(row[0] ?? "");
        if (!item || /^(Item|Column 1)$/.test(item)) continue;
        const speciesCell = cellText(row[2] ?? "");
        if (!speciesCell) continue;
        if (isRepealedRow(stripLabel(speciesCell))) continue;
        considered += 1;

        const where = `${name} Schedule 3 ${isTable1 ? "Table 1" : "Table 2"} item ${item}`;
        if (!isTable1) {
          notEncoded.push({ where, statedAs: table.caption.replace(/␟/g, " — "),
            reason: "Special measures for overabundant species are a separate regime and are not encoded in wave 1." });
          continue;
        }

        const group = federalGroupFor(speciesCell);
        if (!group) throw new Error(`${where}: unrecognised species group ${JSON.stringify(speciesCell)}`);

        const area = cellText(row[1] ?? "");
        const seasons = cellItems(row[4] ?? "");
        const bags = cellItems(row[5] ?? "");
        const possessionCell = cellText(row[3] ?? "");

        /* A declared closure is CLOSED, not UNKNOWN: the authority has said
           there is no season, which is a different fact from silence. */
        if (seasons.length === 1 && /^No open season$/i.test(stripLabel(seasons[0]))) {
          rules.push({
            jurisdictionId, area, groupId: group.id, groupStatedAs: group.statedAs,
            declaredNoSeason: true, statedAs: "No open season", sourceSection: where,
          });
          continue;
        }

        /* Anything with a residency condition, a unit sub-list, or a limit that
           changes inside the window is refused whole. Encoding the readable
           half of such a row would publish a limit that is right for some
           hunters and wrong for others. */
        const rowText = [...seasons, ...bags, possessionCell].join(" | ");
        const refusal =
          /resident/i.test(rowText) ? "the limit or season varies by residency"
          : /\(in Provincial/i.test(rowText) ? "the season applies only in a sub-list of provincial units"
          : /\(from [A-Z]/i.test(rowText) ? "the daily bag changes inside the open season"
          : /plus an additional/i.test(rowText) ? "the daily bag carries an additional species-specific allowance"
          : null;
        if (refusal) {
          notEncoded.push({ where, group: group.statedAs, area, statedAs: rowText, reason: refusal });
          continue;
        }

        if (seasons.length !== 1 || bags.length !== 1) {
          notEncoded.push({ where, group: group.statedAs, area, statedAs: rowText,
            reason: "the row carries more than one season or bag entry and is not a single window" });
          continue;
        }

        const window = readWindow(stripLabel(seasons[0]));
        const daily = readLimit(stripLabel(bags[0]));
        const possession = readLimit(possessionCell);
        if (!window || !daily || !possession) {
          notEncoded.push({ where, group: group.statedAs, area, statedAs: rowText,
            reason: "the season or a limit is not in a form this build reads exactly" });
          continue;
        }

        rules.push({
          jurisdictionId, area, groupId: group.id, groupStatedAs: group.statedAs,
          window, daily, possession, declaredNoSeason: false, sourceSection: where,
        });
      }
    }
  }

  const bundle = {
    schemaVersion: 1,
    bundleId: "bundle:ca-federal-2026",
    jurisdictionId: "jurisdiction:ca-federal",
    sourceVersion: MBR_CITATION,
    sourceUrl: MBR_URL,
    retrievedAt: "2026-09-23",
    contentHash: documentHash,
    wave: 1,
    waveCovers: WAVE_1.map(({ name, jurisdictionId }) => ({ name, jurisdictionId })),
    composition:
      "Federal migratory-bird rules COMPOSE with provincial rules; they never replace them. A hunter must satisfy " +
      "both. Where a federal and a provincial rule disagree, the answer is CONFLICT stating both.",
    rules,
    notEncoded,
  };

  const serialised = `${JSON.stringify(bundle, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const existing = readFileSync(BUNDLE, "utf8");
    if (existing !== serialised) throw new Error("The bundle does not reproduce from the source.");
    console.log("Bundle reproduces byte for byte.");
    return;
  }
  writeFileSync(BUNDLE, serialised);
  console.log(`rows considered ${considered} | encoded ${rules.length} | refused ${notEncoded.length}`);
  console.log(`  declared closures: ${rules.filter((rule) => rule.declaredNoSeason).length}`);
  for (const reason of new Set(notEncoded.map((entry) => entry.reason))) {
    console.log(`  refused: ${notEncoded.filter((entry) => entry.reason === reason).length}x ${reason}`);
  }
  console.log(`Wrote ${BUNDLE} (${documentHash})`);
}

main();
