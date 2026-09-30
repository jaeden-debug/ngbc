import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import bundle from "../../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };
import { ontarioMethodsAndAmmunition } from "../readiness/ontario.ts";

/**
 * ONTARIO'S CROSSBOW, AND THE TWO HOMES THAT HID ITS ABSENCE.
 *
 * "What may I hunt this with" lived in two places built separately and never
 * compared: the certified rules' `permittedImplements`, read by the zone
 * answer, the card and the method filter; and Ready to Hunt's method table,
 * which widened BOW into BOW+CROSSBOW through a one-line lookup. They
 * disagreed on every Ontario species they shared, and because each side was
 * internally consistent nothing surfaced it.
 *
 * The rules were the wrong side, and they were wrong in the direction §8 says
 * nobody reports: a hunter filtering for a crossbow was told there was no
 * opportunity where the law provides one. A refusal always looks defensible.
 * The opposite error any hunter who reads the regulations would catch; this one
 * is invisible to them.
 *
 * Established from the instruments, not from our other table:
 *
 *   O. Reg. 670/98 Tables 1/5/8 give a "Class of Firearm" NUMBER per season;
 *   O. Reg. 670/98 s. 6 sends that number to O. Reg. 665/98 s. 69;
 *   s. 69's Table: "Class 1 … Bow" (also classes 2, 3 and 7);
 *   s. 82: "A person shall not hunt big game with a bow unless it is a
 *     CROSSBOW OR LONG-BOW", at ≥45 kg (crossbow) / ≥18 kg (long-bow) for deer
 *     and ≥54 kg / ≥22 kg for bear, American elk and moose;
 *   s. 79 (1) (b) and (3): the same for wild turkey, at ≥45 kg and ≥18 kg.
 */

const SPECIES = [
  "species:white-tailed-deer",
  "species:moose",
  "species:american-black-bear",
  "species:wild-turkey",
] as const;

const implementsOf = (speciesId: string): Set<string> =>
  new Set(
    (bundle.rules as { speciesId: string; appliesWhen?: { permittedImplements?: string[] } }[])
      .filter((rule) => rule.speciesId === speciesId)
      .flatMap((rule) => rule.appliesWhen?.permittedImplements ?? []),
  );

test("every species whose seasons grant a bow grants a crossbow", () => {
  for (const speciesId of SPECIES) {
    const permitted = implementsOf(speciesId);
    assert.ok(permitted.has("BOW"), `${speciesId}: no bow season at all — check the source, not this test`);
    assert.ok(permitted.has("CROSSBOW"), `${speciesId}: s. 82 puts a crossbow inside "bow" and this omits it`);
  }
});

test("they travel together on every individual rule, not merely in the union", () => {
  /* A union over all rules would pass while a single archery season still
     listed BOW alone — and that season is exactly where a crossbow hunter
     looks. */
  for (const rule of bundle.rules as { id: string; appliesWhen?: { permittedImplements?: string[] } }[]) {
    const permitted = rule.appliesWhen?.permittedImplements ?? [];
    assert.equal(
      permitted.includes("BOW"), permitted.includes("CROSSBOW"),
      `${rule.id}: one of the two bows is missing`,
    );
  }
});

test("a bows-only season is one where every implement is a bow", () => {
  /*
   * s. 26 (1) (a) exempts "the seasons restricted to the use of bows only"
   * from hunter orange. That was computed as `list.length === 1 && list[0] ===
   * "BOW"` — a legal fact read off a field shape — so encoding the crossbow
   * turned every archery season into one requiring orange. Orange is the
   * requirement §62 places closest to safety.
   */
  const archery = (bundle.rules as { appliesWhen?: { permittedImplements?: string[] } }[])
    .filter((rule) => {
      const permitted = rule.appliesWhen?.permittedImplements ?? [];
      return permitted.length > 0 && permitted.every((implement) => implement === "BOW" || implement === "CROSSBOW");
    });
  assert.ok(archery.length > 0, "no bows-only season in the bundle; the orange exemption has nothing to apply to");
  for (const rule of archery) {
    assert.deepEqual([...(rule.appliesWhen!.permittedImplements ?? [])].sort(), ["BOW", "CROSSBOW"]);
  }
});

test("Ready to Hunt no longer widens what the rules say", () => {
  /*
   * The divergence is closed by the rules carrying the fact, not by readiness
   * carrying it too. If this table ever widens again, the two homes are back
   * and the next disagreement will be as quiet as this one was.
   */
  const source = readFileSync("src/lib/hunt/readiness/ontario.ts", "utf8");
  const table = source.slice(source.indexOf("const ENGINE_TO_CLASSES"));
  const body = table.slice(0, table.indexOf("};"));
  assert.match(body, /BOW: \["BOW"\]/, "readiness must pass BOW through, not expand it");
  assert.doesNotMatch(body, /BOW: \["BOW", "CROSSBOW"\]/);
  assert.equal(typeof ontarioMethodsAndAmmunition, "function");
});
