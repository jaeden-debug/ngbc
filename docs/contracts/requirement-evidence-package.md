# Contract — Requirement evidence package

**Status:** proposed 2026-09-24 by the United States agent, who owns the Ready
to Hunt requirements engine. **For research lanes** acquiring requirement
evidence for a jurisdiction.
**You do not need to read the evaluator to fill this in.** That is the point.

---

## What this is for

A research lane reads an authority's own material and returns **evidence**. The
engine turns evidence into answers. Those are different jobs and this file is
the seam.

**A missing North Ground record is a research queue item. It is not evidence
that the requirement is unknowable.** Do not inspect our data, find nothing,
and record NOT_CERTIFIED — that is the workflow this replaces. Go to the
primary authority, read the regulation, the guide, its tables, its exceptions
and anything it incorporates by reference, and establish the exact scope.

**But do not close a gap by inference.** If the source does not settle
something, record it in `unresolved` and move on. An honest unresolved item is
worth more than a plausible guess, and §8 now forbids both directions: a
requirement stricter than the source is as false as one looser than it.

## One package per source

A package covers **one jurisdiction and one source document**. Two sources
means two packages, even for the same species. Provenance stays clean and a
reworded source can be re-read without disturbing the other.

## The shape

```jsonc
{
  "package":   { "jurisdictionId": "jurisdiction:ca-qc", "preparedBy": "<lane>", "preparedOn": "2026-09-24" },
  "authority": { "name": "Ministère de l'Environnement…", "lang": "fr-CA" },
  "source": {
    "id": "source:ca-qc-small-game-2026",
    "title": "<the document's own title, verbatim>",
    "url":   "<the exact page or PDF read>",
    "tier":  "LAW | OFFICIAL_SUMMARY | OFFICIAL_FEE_SCHEDULE | OFFICIAL_DATASET",
    "version": "2026-2028",          // the authority's own edition/version string
    "retrievedAt": "2026-09-24",     // when YOU looked
    "sha256": "<of the text you read, where you can compute it>",
    "incorporates": ["<anything it pulls in by reference that you also read>"],

    // REQUIRED. A hash pins WHICH text; it does not pin whether that text is law.
    "inForce": {
      "state": "IN_FORCE | REPEALED | NOT_YET_IN_FORCE | UNSTATED",
      "statedAs": "<the status line, VERBATIM: 'Abrogé le 1er mai 2008' / 'À jour au 1er mai 2026'>",
      "asOf": "2026-05-01",          // the date the SOURCE says it is current to — not when you looked
      "supersededBy": "<the instrument that replaced it, where the source names one>",
      "checkedOn": "2026-09-24"
    }
  },
  "requirements": [ /* rows, below */ ]
}
```

### A requirement row

```jsonc
{
  "category": "AUTHORIZATION | VISIBILITY | METHOD | AMMUNITION | LIMIT | SPECIES_CONDITION | PLACE_CONDITION | TIME_CONDITION",
  "kind": "<the authority's OWN term: 'permis de chasse au petit gibier', 'tag', 'validation'>",
  "officialName": { "text": "<verbatim>", "lang": "fr-CA" },

  "state": "REQUIRED | ALLOWED | PROHIBITED | NOT_APPLICABLE | CONDITIONAL",
  "statedAs": { "text": "<THE AUTHORITY'S OWN SENTENCE, VERBATIM>", "lang": "fr-CA" },
  "citation": "<s. 26(1), or the guide's own heading>",

  "scope": {
    "speciesIds": ["species:ruffed-grouse"],      // or "ALL", meaning the source says so
    "animalClass": null,                           // source-defined only: 'antlered', 'bearded'. Never derived from sex
    "geography": {
      "kind": "JURISDICTION | ZONE | SUBZONE | COUNTY | SPECIAL_AREA",
      "designations": ["10O"],                     // the authority's own codes
      "statedAs": "<the sentence that sets the geography>"
    },
    "seasonSegment": { "label": { "text": "<authority's own segment name>", "lang": "fr-CA" }, "statedAs": "<…>" },
    "methods": ["<authority's own words>"],         // null where the rule does not turn on method
    "dates":   { "from": "2026-09-19", "to": "2026-12-15", "statedAs": "<verbatim>" },
    "hunterClass": { "residency": null, "age": null, "licenceType": null }
  },

  // REQUIRED when state is CONDITIONAL, forbidden otherwise.
  "condition": { "statedAs": { "text": "<the condition, verbatim>", "lang": "fr-CA" } },

  // ONLY when the authority says how this rule relates to a broader one.
  "composition": { "value": "ADDS | REPLACES | NARROWS | ALTERNATIVE", "statedAs": "<verbatim>", "citation": "<…>" },

  "exceptions": [ { "statedAs": { "text": "<verbatim>", "lang": "fr-CA" }, "citation": "<…>" } ],

  // Only when THIS provision's status differs from the document's — an
  // amendment printed inline that is not yet in force, or a transitional rule.
  "provisionInForce": { "state": "NOT_YET_IN_FORCE", "statedAs": "<verbatim note>", "citation": "<…>" },

  // AUTHORIZATION rows only.
  "obtain":   { "channels": ["ONLINE", "PHYSICAL_VENDOR"], "infoUrl": "<authority's page>", "note": null },
  "requires": [ { "officialName": { "text": "<prerequisite's own name>", "lang": "fr-CA" }, "citation": "<…>" } ],

  "unresolved": ["<what this source did not settle, in your words>"]
}
```

## Eight rules, each of which has already cost us something

1. **`statedAs` is verbatim.** Never paraphrased, never translated, never
   tidied. If our words are presented as the ministry's, that is the trust
   failure the whole product exists to avoid. Keep the original language and
   mark `lang`.
2. **Scope is exact or it is `unresolved`.** Do not widen a rule to make it
   usable and do not narrow it to be safe. §8: *"never claim more than the
   source establishes, but never deliberately claim less either."*
3. **`composition` only when the authority states it, with its sentence
   quoted.** Never infer it from specificity. British Columbia's District 6
   duck seasons **ADD** windows rather than overriding the district-wide one —
   reading narrower-as-override would have closed October for everyone and
   looked like correct scoping. **Undeclared composition is left out, and the
   engine treats that as UNKNOWN.** There is no default, because every
   available default is wrong somewhere.
4. **PROHIBITED needs a source that says so.** Never the complement of a list:
   "everything else is forbidden" is a complement in disguise. A prohibition
   we merely have no record for, shown as law, turns a hunter away — and
   nobody ever reports being wrongly told no.
5. **An exception belongs to the rule it modifies**, as its own entry with its
   own words. In prose it floats away and is read as a separate sentence, or
   not at all.
6. **Read what the source incorporates.** A guide that says "subject to listed
   exceptions" is not the whole rule; the exceptions are part of it. Computing
   a hunting window from a general rule while its exceptions sit unread
   produces a time no authority published.
7. **A conjunction means what it joins.** "Districts C and D" is a list;
   "the islands and waters of James Bay" is one place; "the portion north of X
   and the portion east of Y" is a union; "the portion north of X and east of
   Y" is ONE portion with two conditions. The tell is whether the noun repeats.
   When unsure, quote it and put it in `unresolved`.

## The LIMIT category

Bag and possession limits are their own category because two of the nine
completeness facts are limits, and because every shortcut here is wrong by a
multiple rather than by a detail.

```jsonc
{
  "category": "LIMIT",
  "kind": "BAG | POSSESSION",

  // REQUIRED. No default, ever.
  "period": "DAY | SEASON | LICENCE_YEAR",

  "value": { "count": 10, "statedAs": "<the verbatim cell or sentence>" },

  // REQUIRED. Say which, with the sentence that settles it — never leave it implied.
  "appliesAcross": {
    "scope": "THIS_SPECIES | AGGREGATE",
    "speciesIds": ["species:blue-grouse", "species:spruce-grouse", "species:ruffed-grouse"],
    "statedAs": "the daily aggregate bag limit is 10"
  },

  // An aggregate that caps one member below the whole.
  "subCaps": [ { "speciesIds": ["species:blue-grouse"], "count": 5, "statedAs": "of which only 5 can be blue grouse" } ],

  // ONLY when the AUTHORITY states the derivation. Never when we compute one.
  "derivedByAuthority": {
    "ofKind": "BAG", "ofPeriod": "DAY", "multiplier": 3,
    "statedAs": "3 times the daily bag limit for game birds, excluding migratory game birds",
    "excludes": ["migratory game birds"], "citation": "s.12(b)(vii)"
  },

  // Where the figure is a table notation rather than prose.
  "notationDefinedBy": { "citation": "s.9(2)", "statedAs": "<the provision that decodes '5(15)'>" }
}
```

**`period` is required and has no default.** A season limit rendered as a daily
one is wrong by an order of magnitude, and B.C. Reg. 190/84 proves both live in
one instrument: its own Part 1 header reads *"Season bag limits for big game
and small game; daily bag limits for upland birds."* A model that assumes daily
gets big game wrong throughout.

**`appliesAcross` is required, and "this species" is a claim needing a
sentence.** Québec's five-bird daily limit is an AGGREGATE across four species;
a per-species reading is wrong by 4×. British Columbia does the same and then
caps one member below the whole. Leaving the field out so it defaults to
per-species is precisely the error, so there is no default — say which, and
quote the sentence.

**`derivedByAuthority` exists because the rule it appears to break is narrower
than it sounds.** "Never derive a possession limit from a daily one" was
written against US doing the deriving. B.C. s.12(b)(vii) has the AUTHORITY
doing it: *"3 times the daily bag limit for game birds, excluding migratory
game birds."* That is the regulation's own sentence, and refusing to represent
it would be claiming less than the source establishes — the other half of §8.

So the rule means: **never compute a derivation the authority did not state.**
A stated one is recorded with its multiplier, its exclusions and its sentence,
and the engine may evaluate it **only when the limit it references is itself
certified** — a derivation from an uncertified base is a number we calculated
wearing the authority's words.

**A table cell is not self-describing.** `"5(15)"` means daily 10 / possession
20 only because s.9(2) says so. Record the cell verbatim AND the provision that
decodes it; a figure whose notation lives elsewhere is not evidence on its own.

## Rule 8: authenticity is not currency

**Required, and it is the newest rule because it nearly cost us a wrong
answer.** Searching for Québec's hunter-orange requirement leads to
C-61.1, r. 22 — right title, official publisher, LégisQuébec, and the page
says **"Ce document a valeur officielle."** It was also **repealed on 1 May
2008**. The live requirement is r. 1, SECTION III.1, arts. 17.1–17.3, inserted
by the same decree that repealed r. 22: the requirement MOVED, it did not
disappear.

**"Ce document a valeur officielle" attests the text's AUTHENTICITY, not its
CURRENCY.** Every consolidated-statute site has this shape — LégisQuébec,
e-Laws, CanLII, BC Laws, the US state codes.

What makes it dangerous rather than merely wrong: the repealed text and the
live one are **nearly identical** — same 2 580 cm², same 595–605 nm colour
spec, same exemption structure. So citing the dead regulation produces a
**correct-sounding answer with a dead citation**, which no amount of reading
the text will catch. Only the status line distinguishes them, and a hash of the
repealed text verifies perfectly forever.

So:

- **`source.inForce` is REQUIRED, never optional.** An omitted field and a
  repealed source render identically at every call site that forgets one.
- **`UNSTATED` is a permitted value and it BLOCKS certification.** Some sources
  state no currency at all; that is an honest answer and it is not IN_FORCE.
  Never default to in force — the absence of "repealed" is not a statement that
  something is current, which is rule 4 in a new place.
- **`asOf` is the source's own currency date and is NOT `retrievedAt`.** A
  document fetched today may be current only to 2024. Those are two different
  facts and conflating them is how a stale consolidation passes as fresh.
- **`provisionInForce` exists because the document is not always the unit.**
  Ontario's Time Act carries 2020 c. 28 amendments **printed inline and not in
  force**: the document is in force, the provision is not, and an implementer
  reading the notes would encode the wrong UTC offset. A document-level field
  alone cannot express that.
- **A requirement whose source is REPEALED, or whose provision is
  NOT_YET_IN_FORCE, is never CERTIFIED.** Record it, cite the live instrument
  where the source names one, and note the trap — because the next researcher
  will hit the same search result.

## Reporting a measured absence

You searched properly and found nothing. That is a result, not a blank, and it
has its own shape:

```jsonc
"absenceEvidence": {
  "fact": "HUNTER_ORANGE",
  "searchedOn": "2026-09-24",
  "instruments": ["B.C. Reg. 190/84", "Wildlife Act", "<…the rest…>", "2026-2028 synopsis"],
  "terms": ["orange", "fluorescent", "blaze", "<…nine…>"],
  "control": { "term": "Blazed Creek", "matched": true },
  "closedBy": "<what would settle it: an authority statement, or a closed-world clause>"
}
```

**Run a control.** A term you know is present in the same text, matched by the
same method. Without it a zero is indistinguishable from a broken search — a
wrong regex, a PDF whose text layer is images, a page that loaded empty. BC's
lane matched "Blazed Creek", which is why its nine zeroes are evidence.

**Do not record it as NOT_APPLICABLE on your own authority**, and the BC lane
was right not to. *"No provision found in these instruments"* and *"this
jurisdiction has no such requirement"* are different claims. The first is about
your search; the second is about the law, and it does not follow, because the
provision may live in an instrument that was not among the ones you read.

**What closes it:** a positive statement from the authority ("no hunter orange
requirement applies to..."), or a closed-world clause reaching that requirement
class — the way B.C. Reg. 190/84 s.4 closes the world for SEASONS by saying the
open seasons ARE those in the Schedules. A closed-world clause for one class
does not close another: BC's seasons clause says nothing about clothing.

Until then the fact stays RESEARCH_REQUIRED **with your evidence attached**, so
nobody searches those nine terms again and the next lane knows exactly what to
go and get.

## What "complete" means for one species

The engine reports a jurisdiction × species as complete when each of these is
CERTIFIED or NOT_APPLICABLE: **season · licence/permit · methods · ammunition ·
hunter orange · legal hours · daily limit · possession limit · critical
exceptions.** Anything else is RESEARCH_REQUIRED, SOURCE_BLOCKED or
EVIDENTIARY_CONFLICT.

So a package is most useful when it covers a whole species against a whole
source, rather than a single interesting rule.

## What a research lane does not do

- Does not modify the engine, its types, or any jurisdiction's bundle.
- Does not invent a schema. If this one cannot express what a source says,
  **that is a finding** — report it through the moderator rather than
  approximating. The shape changes to fit the law, not the other way round.
- Does not route around an access control. A data service gating its callers is
  a gate; a public document's CDN refusing non-browser clients is a delivery
  mechanism, and a real browser is the right answer there. Unclear goes in the
  gate column, and what you tried gets recorded.
- Does not decide legal status. Evidence in, answers out.
