# Contract — Bulk zone summary

**Status:** landed. Written 2026-09-23 against code already on main, after the
owner's ruling on the bulk zone-summary capability.
**Scope:** what one (zone, date) request answers, and the two canonical paths
that answer it.

> This document exists because two "contracts" governing this feature turned
> out to live only in agent conversation — a zone-summary contract that was
> never written down, and a five-state vocabulary that appears nowhere in the
> repository. Both were relayed confidently and neither existed. **Read this
> file; do not reconstruct the architecture from conversation history.**

---

## The two canonical paths

Named architecture, not implementation detail. **Do not build a replacement.**

| direction | function | serves |
|---|---|---|
| zone + date → species | `summarizeZone(ref, date)` in `src/lib/hunt/exploration/zone-summary.ts`, behind `/api/hunt/zone-summary` | the zone card |
| species + date → zones | `zoneStatesForSpecies(...)` in the same module | the map's species filter, and the Find Game foundation |

**One call per (zone, date).** Never N per-species requests from the client.
Ordering is the consumer's. Counts are derived by the consumer from the rows.

---

## One engine, and it must be provable

Both paths call `entry.evaluate` through `regulatoryEntryFor` — **the same
engine as individual Hunt evaluation.** There is no second rules interpretation
and there must never be one, including in the endpoint or the client.

The risk this feature carries is a fast path that quietly answers differently
from the slow one, because both look right in isolation. So it is tested rather
than asserted: `zone-summary.test.ts` compares every bulk row against a direct
`entry.evaluate` call for the same inputs. That test extends across every
rules-certified jurisdiction — one jurisdiction proves the mechanism, all of
them prove the claim.

**Anything derived from an answer must read the engine's own output**, never
re-derive it. `next` reads the engine's resolved windows; recomputing them
would be a second interpreter wearing the costume of plumbing.

---

## Eight states, and presentation may show fewer

`ExplorationState` in `src/lib/hunt/exploration/states.ts`. **UI simplification
is presentation only; the engine and the API contract keep all eight.** A
consumer's vocabulary must never narrow the engine's — the same principle as
`serving` versus `rulesServing`.

| state | label | means |
|---|---|---|
| `SEASON_AVAILABLE` | In season | open for every licence the rules recognise |
| `SEASON_EXCEPT_AREAS` | In season outside restricted areas | open across the zone except inside published restricted areas (§41A forbids claiming a season inside one) |
| `CHECK_REQUIREMENTS` | Depends on your hunt | turns on who is hunting and how |
| `CLOSED` | Closed | no season open here on this date under certified rules |
| `NEEDS_VERIFICATION` | Needs a closer look | differs within the zone, or outside the certified period |
| `CONFLICT` | Sources disagree | official sources disagree; North Ground will not choose |
| `UNKNOWN` | Not covered here | no certified rule covers this species in this zone — a coverage gap, never a closed season |
| `NOT_CERTIFIED` | Not certified | no certified rules for this species in this jurisdiction |

Three of these are distinctions that cost real work to keep and would be lost
by collapsing to five: `CONFLICT`, `SEASON_EXCEPT_AREAS`, and `NOT_CERTIFIED`
versus `UNKNOWN`. **Statuses that render identically while meaning opposite
things is the most repeated failure in this programme.** Every state carries a
label and a glyph, so none is carried by colour alone.

A zone card never says OPEN, and UNKNOWN is never drawn as CLOSED.

---

## `next` is supplementary, never a ninth status

**A `CLOSED` row carries its next opening and stays `CLOSED`.** "What is true
today" and "what happens next" are orthogonal facts. "Closed" and "closed,
opens September 15" are different answers to a hunter, and neither is a
different legal status.

`NextSeason` in `src/lib/hunt/regulatory/season.ts` — **required**, and a
discriminated union:

| kind | means |
|---|---|
| `SEASON` (`opens`, `closes`) | a further season is established |
| `DEPENDS_ON_HUNTER` | there is a next opening, but which one turns on the hunter |
| `NONE_IN_CERTIFIED_PERIOD` (`through`) | certified through that date, and nothing further begins before it |
| `NOT_CERTIFIED` | no certified basis for saying. **Never "none".** |

Required rather than optional because the owner's distinction —
closed-until-further-notice versus we-do-not-know — **dies the moment it is
carried by absence**: an absent field and a null field render alike at every
call site that forgets which it meant.

`NONE_IN_CERTIFIED_PERIOD` carries `through` because it is a statement about
what the sources certify, not about the world: the authority's next summary may
open a season the day after that date.

`DEPENDS_ON_HUNTER` is not a hedge. Where an answer needs a fact from the
hunter the engine returns **before evaluating any season window**, so there is
nothing to read a next opening from; one stated anyway would be true for only
some licences. It is read from the engine's own `completeness`, never from a
second pass over the rules.

A composed federal + provincial answer needs the first date **both** layers
permit, which is neither side's own next opening. Until that is computed the
composition is `NOT_CERTIFIED` — it must never become a passthrough.

---

## Identity is the server's; naming is the presentation layer's

The response carries `speciesId` and **no display name.** There must be one
naming system, not a parallel bulk-response one — a server-side name becomes a
second naming system the moment there are two locales, and would drift from
`zone-presentation`'s path exactly as a second rules interpretation would drift
from the engine. Same principle, different axis.

**Invariant, tested: every returned `speciesId` resolves through the
presentation path. An id that cannot resolve is a contract or data defect that
fails loudly — never a hole plugged with a server-provided fallback.** A
fallback would keep the name path silently working until a locale was added and
nobody could say which system was in use.

Consequence: rows are no longer ordered by name on the server. **Ordering is
the consumer's.**

---

## Every recognised species is present

Including `UNKNOWN`, with a reason. **A species absent from the array is
indistinguishable from one with no season**, and silence must never be rendered
as closed.

The response carries the inputs it answered — zone identity and date — so a
stale response can be discarded rather than shown.

Every string is marked as whose it is: North Ground's own, or the authority's
quoted with its `lang` and never translated or reformatted.

There is no `critical` flag. **Loudness is presentation.**

---

## Payload, measured

Measured with real `summarizeZone` calls on a cold cache, not estimated:

| zone | species | payload | time |
|---|---|---|---|
| Québec 10O | 10 | 2.9 KB | 2 ms |
| Ontario WMU 57 | 8 | 3.3 KB | 3 ms |
| Manitoba GHA 26 | 4 | 2.6 KB | 4 ms |
| Alberta WMU 200 | 4 | 2.3 KB | 1 ms |

About **260 bytes per species row**. The largest species count in any served
jurisdiction is **10** (Québec). A hypothetical 59-species zone would land near
**15 KB against a 150 KB budget**.

**"A 59-species zone" was a conflation** of Québec's 59 *zones* with its species
count, and it reached a budget requirement before anyone measured it. Recorded
here so no one re-derives a budget from it.

**No pagination and no progressive loading.** The measurements are the reason.
