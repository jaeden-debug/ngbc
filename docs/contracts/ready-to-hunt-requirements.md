# Contract — Ready to Hunt requirements model (North Ground's half)

**Status:** proposed 2026-09-24 by the United States agent, who owns the
requirements model. For Hunt overhaul (consumer, owns presentation) and the
Canada agent (legal hunting time, bulk open-species path). Moderator arbitrates.
**Scope:** what can TRUTHFULLY be answered about "what do I need, what may I
use, what is forbidden, before I go?", and the shape that answer takes.
**Not in scope:** how it is rendered, legal hunting time, season status.

---

## A defect first, because it decides the whole design

`ReadinessResult.methods.notAllowed` is `MethodClass[]` — a bare list of enum
values, with no provenance and no status. It is built (`ontario.ts:235`) as:

```ts
const standard: MethodClass[] = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "BOW"];
const notAllowed = standard.filter(
  (method) => !legal.includes(method) && (table.notAllowed[method] || !group.smallGame || speciesId === TURKEY),
);
```

Read the condition after the `&&`. A method qualifies if the source table says
it is not allowed **or** this is big game **or** this is turkey. So for every
big-game hunt, any of the four standard methods missing from our `legal` list
is asserted to the hunter as "Not allowed" — whether the law prohibits it or
whether North Ground simply has no row.

The source table *does* carry provenance for genuinely prohibited methods
(`notAllowed: Record<string, Provenance[]>`). The output type discards it, then
places inferred prohibitions beside the sourced ones where nothing can tell
them apart. The component renders them together as a "Not allowed" chip — the
only line in Ready to Hunt with no source link, because there is no source to
link.

This is the Yukon mistake in a second place: **a restriction stricter than the
source, shown as law.** It is worse here than a wrong OPEN, because a hunter
who reads "Rifle: Not allowed" does not go. And it is the same shape as the
specialization-as-conjunction error — a real distinction flattened because the
simpler form was available.

Everything below follows from refusing that flattening.

## One vocabulary, every category

Every statement the model makes carries one of these, and they mean the same
thing everywhere:

| Status | Means | Requires |
| --- | --- | --- |
| `REQUIRED` | The law requires it for this hunt | a source |
| `ALLOWED` | The law permits it | a source |
| `PROHIBITED` | The law forbids it | **a source that says so** |
| `CONDITIONAL` | Applies only under a stated condition | a source **and** the condition |
| `NOT_APPLICABLE` | The law addresses it; it does not reach this hunt | a source |
| `NOT_CERTIFIED` | North Ground has not established this | nothing — it is the default |

**`NOT_CERTIFIED` is the default for everything.** A category with no certified
record is `NOT_CERTIFIED`, renders as "Verify requirement" with the authority's
link, and never disappears — a missing row reads as "nothing required", which
is the one thing silence must never mean.

**`PROHIBITED` is never derived from absence.** It is a positive claim needing
positive evidence, exactly like OPEN. The two are not opposites of each other:
the opposite of `ALLOWED` is `NOT_CERTIFIED`, not `PROHIBITED`.

## Conditions travel with the status

A `CONDITIONAL` statement is invalid without its condition. The type enforces
it rather than trusting a builder:

```ts
type Statement<T> =
  | { status: "REQUIRED" | "ALLOWED" | "PROHIBITED" | "NOT_APPLICABLE"; value: T; provenance: Provenance[] }
  | { status: "CONDITIONAL"; value: T; condition: Condition; provenance: Provenance[] }
  | { status: "NOT_CERTIFIED"; value: T; verifyAt: string };
```

`condition` carries both the machine form (the engine's own dimensions, so no
second questionnaire) and `statedAs` — the authority's words. A renderer that
cannot use the machine form still has a true sentence to show. "Hunter orange ✓"
where the law says "while hunting X during Y" is a false claim; the condition is
not decoration.

## Requirement is not possession

`possessionVerifiable: false` already exists and stays. No field anywhere may
express, imply, or be renderable as "you have this". The model states what the
law requires; what the hunter holds is not knowledge North Ground has or wants.

## The method vocabulary must open

`MethodClass` is a closed union of six. The brief says "and whatever else an
authority recognises", and a closed union cannot carry handgun, atlatl,
falconry, dogs, bait, or the next thing a state names. It becomes:

```ts
{ classId: MethodClass | null; officialName: string }
```

`officialName` is always the authority's own term and is what is displayed.
`classId` is for behaviour and grouping only, and is `null` where nothing in our
vocabulary fits — which is a supported state, not a gap.

**The worked example, because it is a better argument than the rule.** The
defect above was not fixed by correcting the hardcoded list. It was fixed by
deleting the list, because the list was the fault: any closed set of methods
invites taking its complement, and a complement over a set that does not
describe the world asserts prohibitions nobody legislated. A longer enum would
have reproduced the same bug at a larger size — more methods wrongly forbidden,
not fewer. **There is no universal set of methods to take a complement
against**, which is why the vocabulary has to open rather than grow.

The same reasoning is why `PROHIBITED` cannot be the default for anything:
every "everything else is forbidden" is a complement in disguise.

## Categories

Each is a set of `Statement`s. Present as `NOT_CERTIFIED` rather than absent.

- **Authorization** — licence, species licence, tag, validation, stamp, permit,
  draw authorization, hunt code, limited entry, federal permit, conservation
  requirement, identification, hunter education, residency, youth. Mostly built
  (`AuthorizationRecord`); gains `PROHIBITED`/`NOT_APPLICABLE` and the shared
  status set. Federal and state/provincial compose in one list — **conjunction**,
  two authorities both binding (not the specialization relation; see
  `several-zones-at-one-point.md`).
- **Visibility** — orange and equivalents, with amount and placement where the
  law specifies, and exemptions. `OrangeResult` exists; generalises to
  visibility, since not every authority uses orange.
- **Method** — above.
- **Ammunition and projectile** — non-toxic shot, calibre, gauge, magazine
  capacity, projectile type, archery specifications.
- **Species condition** — sex, age, animal class (antlered/antlerless/bearded —
  source-defined, never derived from biological sex; CLAUDE.md §16), bag,
  possession, tagging, reporting.
- **Place condition** — where within the zone this changes.
- **Time condition** — where within the day or season this changes. Legal
  hunting time itself is Canada's; this carries only conditions that attach to
  a requirement.

## Coverage is per capability, computed

No `readyToHuntSupported` boolean, and `ReadinessCoverage = VERIFIED | PARTIAL |
UNAVAILABLE` is replaced: one word for a jurisdiction hides exactly what it
exists to show. Per regulatory jurisdiction and per capability — season status,
legal time, licence, authorization/tag, visibility, method, ammunition,
bag/possession, tagging/reporting, critical location restrictions — each
`CERTIFIED | PARTIAL | NOT_CERTIFIED`, **computed from the bundles at call
time**, never typed. Same discipline as `canada/report.ts`: no number or state
in the report can be edited into existence.

## Law and advice

Unchanged from §41A and already enforced: `REQUIRED`/`ALLOWED`/`PROHIBITED` are
law, each with its source; `RECOMMENDED` is North Ground's, labelled, checked
against the legal restriction it sits beside, and unable to change a status.

## Fees

Unchanged and already correct: only from the licence year in force, category
known, resident and non-resident never mixed, otherwise "Check current official
fee". `PriceState` already models this.

## What I need from Hunt overhaul

1. Can you render a `CONDITIONAL` in one scannable pass without dropping its
   condition? If a condition cannot survive the layout, the layout decides the
   legal claim, and I need to know that before I build states you cannot show.
2. How should `NOT_CERTIFIED` read? It must be visibly different from both
   "not required" and "prohibited", and a scanner must not read its absence of
   a requirement as absence of requirements.
3. Do you need a stable display order across categories, or will you order them?

## What I need from Canada

1. Legal hunting time is yours — confirm it stays out of this model, referenced
   rather than duplicated.
2. Québec's checklist is currently a sentence saying we have not built one. Is
   Québec yours to populate once this shape is agreed, or mine?

## Migration

`notAllowed` is fixed first and independently of the rest: keep only methods
with a source, carry their provenance, drop the inference. That narrows a live
false claim and does not wait on the model.
