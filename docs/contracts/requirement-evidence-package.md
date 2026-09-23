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
    "retrievedAt": "2026-09-24",
    "sha256": "<of the text you read, where you can compute it>",
    "incorporates": ["<anything it pulls in by reference that you also read>"]
  },
  "requirements": [ /* rows, below */ ]
}
```

### A requirement row

```jsonc
{
  "category": "AUTHORIZATION | VISIBILITY | METHOD | AMMUNITION | SPECIES_CONDITION | PLACE_CONDITION | TIME_CONDITION",
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

  // AUTHORIZATION rows only.
  "obtain":   { "channels": ["ONLINE", "PHYSICAL_VENDOR"], "infoUrl": "<authority's page>", "note": null },
  "requires": [ { "officialName": { "text": "<prerequisite's own name>", "lang": "fr-CA" }, "citation": "<…>" } ],

  "unresolved": ["<what this source did not settle, in your words>"]
}
```

## Seven rules, each of which has already cost us something

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
