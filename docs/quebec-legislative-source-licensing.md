# Decision package — Québec legislative sources (legisquebec.gouv.qc.ca)

**Status:** evidence for an owner decision. **This is not a recommendation.**
**Prepared:** 2026-09-23.
**Why it exists:** the owner declined to rule casually, on the grounds that it
"can affect every Québec rule rather than one UI behaviour." That is correct,
and section 5 quantifies it.

Two questions are asked here, and **they may not have the same answer**:

- **Q1 — retrieval.** May North Ground read legisquebec **programmatically**,
  given that the site refuses our own user-agent and serves a browser one?
- **Q2 — reuse.** May North Ground **store verbatim text** from the Éditeur
  officiel in its bundles and **serve it to hunters commercially**, and under
  what attribution?

A yes to Q1 with a no to Q2 is a coherent outcome and there is a design for it
(section 7).

---

## 0. What is already settled, so it is not re-argued

`src/lib/hunt/source-licence.ts` draws the line and it was applied here:

> A **bot filter** on a public web page … is not a decision about who may read
> the regulations; the page is published TO THE PUBLIC and the refusal is aimed
> at automated clients generally. Reading it in a real browser is not
> circumvention: it is using the document the way it is published.

legisquebec is a public legislation site, not a gated data service. **A
human-equivalent read through the browser pane is settled as permitted and is
not part of this decision.** Everything read so far was read that way, plus one
manual file retrieval described in section 1.

The same file also states the standard this package tries to meet:

> When it is genuinely unclear, treat it as a gate and say so — and record what
> was tried, so the next person inherits evidence rather than a verdict.

---

## 1. The source, exactly

Publisher: **« L'Éditeur officiel du Québec »**. The document page carries
**"Ce document a valeur officielle."**

### Already read (browser pane, human-equivalent)

| Instrument | Form | URL | `asOf` |
|---|---|---|---|
| **C-61.1, r. 12 — Règlement sur la chasse** | HTML, consolidated | `/fr/document/rc/c-61.1, r. 12` | **« à jour au 1er mai 2026 »** |
| — art. 17 (antlerless moose, five permitted cases) | within the above | same | same |
| — art. 31 (definition of the 14 numbered **engin** types) | within the above | same | same |
| **C-61.1 — Loi sur la conservation et la mise en valeur de la faune** | HTML, consolidated | `/fr/document/lc/C-61.1` | **« à jour au 10 juin 2026 »** |

**The two `asOf` dates differ by nearly six weeks, and that is a real property, not an
error.** `asOf` is per instrument and must never be inherited from a sibling: a
statute and its regulation are consolidated on their own schedules.

### Already retrieved as a file (one manual download)

| Artefact | Detail |
|---|---|
| **Annexe III — « Périodes de chasse dans les zones »** | PDF, 9 pages, **148,728 bytes**, `%PDF-1.7`, internal title `Microsoft Word - ANNEXE III (16 janvier)` |
| URL | `/fr/ressource/rc/C-61.1R12_FR_002_020.pdf?langCont=fr&cible=…` |
| sha256 | `a92326176f3c369c45193d80c78d5fcc53116a016a3b99bfe8708c1d6ca9f62e` |
| How | one `curl` with a browser user-agent, **after** the same URL had been opened in the browser pane. No crawl, nothing scripted, not committed; held in session scratchpad. |

This is the one act in the record that is **not** purely a browser read, and it
is disclosed rather than buried. It is also the reason Q1 is being asked now
rather than later.

**Annexe III is the only place that assigns a numbered engin type to a (zone,
period).** Its moose section is organised by type first, zone second. Nothing on
quebec.ca carries this (section 6).

### Would need to be read, and is not yet

| Needed for | Instrument |
|---|---|
| Québec legal hunting hours | r. 12 arts. 30.1, 30.3 and 21 — each already flagged as a trap: s.30.1's night definition supports an **evidentiary presumption**, not legal hours; s.21's night snaring of hare is a **permission**, not a window; s.30.3 carries its exception **inside the sentence** (« à moins de pratiquer une activité de chasse permise »), so omitting it makes a lawful night hare hunt read as illegal |
| Hunter orange, and why gear class is a **safety** matter | **C-61.1, r. 1**, s. 17.3(1) — exempts big game hunted « au moyen d'un engin de type 6 ou 11 », and **not** type 12 |
| The art. 17 anchor | r. 12 art. 17 is read; anchoring it in the build needs it as stored data |

---

## 2. The terms — **NOT ESTABLISHED**, and the absence is **uncontrolled**

**This is the weakest part of the package and it is labelled as such.**

In the codebase's own vocabulary the honest current record is
`permittedUse: "UNRESOLVED"` and `redistribution: "UNRESOLVED"` — **not**
`RESTRICTED`, and certainly not permitted. No `statedAs` can be quoted because
none has been found.

### Where I actually looked

One place: the **regulation document page itself** (`/fr/document/rc/c-61.1, r.
12`, 776,835 bytes of HTML). Searched for `droit d'auteur`, `Éditeur officiel`,
`reproduction`, and every link whose text matched
`droit|auteur|condition|utilisation|copyright|avis`.

**Found:** the publisher name « L'Éditeur officiel du Québec », and
"Ce document a valeur officielle." **The only `reproduction` match was
substantive text about decoys**, not a licence.

### Why that is not yet an answer

**An absence without a control is exactly what this project forbids
everywhere else.** I searched one page and found nothing; I have not shown that
the search would have found terms had they existed elsewhere. Reporting "no
terms exist" from that would be the §8 inference failure — *I could not find a
restriction* silently becoming *there is no restriction* — in the one place
where it would be most expensive.

### Where the terms most likely are — named, not read

These links are present **on the document page itself**, so they cost one click
each:

| Candidate | Path | Why it is a candidate |
|---|---|---|
| **Politique du ministre de la Justice** | `/fr/contenu/mjqpol` | A ministerial policy on the official publication service is the most probable home for reproduction conditions |
| Note d'information | `/fr/contenu/noteinfo` | Often carries status and use notes |
| Quoi de neuf? | `/fr/contenu/neuf` | Lower probability; listed for completeness |

Not yet examined either: the **Éditeur officiel's own publisher site**, the
**Loi sur les publications officielles / Loi sur le Centre de services
partagés** or whatever governs official publication, and the **PDF's own
metadata**.

> **This package cannot answer Q2 until at least `/fr/contenu/mjqpol` is read.**
> That read is a browser-pane read of a public page, which section 0 records as
> already settled. It was not done because the instruction for this task was
> "nothing new retrieved". **Flagged rather than performed**, and it is one
> click from being resolved.

---

## 3. The access fact — measured

Same URL, same moment, only the user-agent differing:

```
User-Agent: NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)   -> 403
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
            (KHTML, like Gecko) Chrome/125.0 Safari/537.36                     -> 200
```

`robots.txt` itself behaves the same way (403 to a short agent, 200 to the full
browser string). Its full contents:

```
User-agent: *
Disallow: /fr/showVersion
Disallow: /fr/showPdf
Disallow: /fr/resource
Disallow: /fr/search
Disallow: /fr/searchadvanced
Disallow: /fr/result
Disallow: /fr/searchannual
```

**The spelling, printed so it can be judged rather than taken on trust:**

```
disallowed :  /fr/resource     ← one s
annexe III :  /fr/ressource/rc/C-61.1R12_FR_002_020.pdf     ← two s, the French spelling
```

As literal prefix matching, `/fr/ressource/…` **is not** matched by
`Disallow: /fr/resource`. My own assessment, unchanged: **a one-letter spelling
difference is too thin a thing to rely on**, and relying on it would be reading
a permission into what is very possibly a typo. `/fr/showPdf` is also
disallowed, which suggests the intent was to keep crawlers off document files
generally.

---

## 4. The proposed use — stated without softening

A licensing decision made against a softened description is worthless, so:

1. **North Ground is a commercial product.**
2. We would **store verbatim regulation text** in committed bundles — the art.
   31 definitions of each engin type are the immediate case, and Québec legal
   hours would be more.
3. We would **serve that text to hunters**, in the authority's own language
   (§47 requires the authority's words where the words are the fact).
4. We would **automate retrieval on a schedule**, to detect consolidation
   changes — which under the current access behaviour means a scripted client
   **presenting a user-agent we are not**.
5. We would **derive structured data from it** (gear classes, the art. 17
   constraint) and serve those derivations.
6. Per blueprint §11, the regulatory engine **may later be licensed to third
   parties or governments**. Any grant relied on should be read with that in
   view, not only against today's website.

Point 4 is Q1. Points 1–3, 5 and 6 are Q2.

---

## 5. What it gates, with counts

Counted from the committed bundle `content/regulatory/ca-qc-2026.json`:
**186 rules, 10 species, 58 zone designations.**

| Gated item | Scope |
|---|---|
| **Gear classes (`scope.gearClasses`)** | **52 rules** across **3 species** and **51 designations** are bow/crossbow-only seasons — precisely where type 11 and type 12 are indistinguishable from the implement list. 178 of 186 rules carry an implement set; 114 include a firearm. |
| **The art. 17 anchor** | **16 antlerless-moose rules** across **8 designations**. The build is currently correct and guarded — but anchored to **MFFP's summary prose**, not to the regulation. |
| **Québec legal hours** | **9 of 10 species have no hours statement at all** from our licensed source (section 6). |

**The safety weighting, which is not proportional to the counts.** The 52
bow/crossbow rules are not merely a completeness gap: r. 1 s. 17.3(1) exempts
big game hunted with an **engin de type 6 or 11** from hunter orange, and not
type 12. A hunter drawing a bow may be under either. An engine holding
`["BOW","CROSSBOW"]` cannot tell, and the failure direction is telling someone
they need **no orange** when the law requires it.

> A wrong season is caught by a hunter who checks. **A wrong orange exemption is
> discovered by not being seen.**

This is why the correct output while blocked is **UNKNOWN**, and why
reconstructing a class from `permittedImplements` must not be used as a
workaround. That is recorded in `docs/PROJECT-STATE.md` under Blocked.

---

## 6. Alternatives — measured, not assumed

### Gear type definitions: **no alternative exists on quebec.ca**

Across all five quebec.ca season pages we already ingest (saved copies, 86–95 KB
each):

| Page | "engin" | "engin de type" | any "type N" |
|---|---|---|---|
| cerf-virginie | 2 | **0** | **0** |
| dindon-sauvage | 0 | **0** | **0** |
| orignal | 0 | **0** | **0** |
| ours-noir | 0 | **0** | **0** |
| petit-gibier | 13 | **0** | **0** |

The ministry uses **« Engin »** as a *column heading* whose values are implement
names — "Engin : arbalète et arc", "Engin : armes à feu, à l'arbalète et à
l'arc". **It never publishes the numbered class.** That is the whole gap: the
ministry publishes the equipment, and only the Règlement publishes the identity
that the orange exemption and art. 17 turn on.

### Legal hours: a **partial** alternative exists

quebec.ca **does** state hours for wild turkey, and we already carry it:

> « La chasse est permise à partir d'une demi-heure avant le lever du soleil
> jusqu'à midi. »

Controlled search across the same five pages — the query **finds** the turkey
statement, so a zero elsewhere is a real absence and not a broken query:

| Page | "lever du soleil" | "demi-heure" | "midi" |
|---|---|---|---|
| dindon-sauvage | **1** | **1** | **1** |
| cerf-virginie | 0 | 0 | 0 |
| orignal | 0 | 0 | 0 |
| ours-noir | 0 | 0 | 0 |
| petit-gibier | 0 | 0 | 0 |

So **1 of 10 species** has hours from the already-licensed source, and **9 do
not**. A no to Q2 does not leave Québec hours at zero — it leaves them at
turkey.

**A blocked source with a viable alternative is a different decision from one
without.** Here: gear classes have **no** alternative; hours have a **partial**
one.

---

## 7. The two questions, and what each outcome permits

| | **Q2 = yes** (store and serve verbatim) | **Q2 = no** |
|---|---|---|
| **Q1 = yes** (retrieve programmatically) | Everything in section 5 proceeds; scheduled change-detection works. | **Identity-only path**: store the **code** ("11"), the **official term** (« engin de type », four words), and the **citation** — no reproduced definition. Art. 17 anchor and gear classes both become possible; the authority's own wording is linked, never copied. |
| **Q1 = no** | Verbatim text permitted but every read is manual and periodic; no change-detection. Workable for a one-off population, fragile as a standing source. | Québec stays as it is today: correct, guarded by MFFP prose, and with gear class permanently **UNKNOWN** — which is a safe answer, not a wrong one. |

The identity-only path was proposed to the engine owner, **with a caveat now
attached to it**: making `GearClass.statedAs` merely optional would weaken the
verbatim guarantee everywhere, and a row that legally *cannot* carry a
definition would look identical to one that simply forgot it. If that path is
taken, the optionality should be a **named state** meaning *"definition not yet
reproducible, identity certified"*.

---

## 8. What would make this package complete

1. **Read `/fr/contenu/mjqpol`**, plus the Note d'information, the Éditeur
   officiel's publisher page, and whatever statute governs official
   publication. Quote what is found, verbatim, with a retrieval date and a
   hash. **One browser read is likely to resolve Q2 outright.**
2. If terms are found, record them as a `SourceLicence` — `statedAs`, `url`,
   `retrievedAt`, `sha256`, `permittedUse`, `redistribution`, `attribution` —
   so a reworded licence later shows up as a visible change.
3. If terms are genuinely absent after a controlled search, **that is itself a
   finding** and the state stays `UNRESOLVED`, which blocks serving until a
   person resolves it. Absent is not permissive.

Until then this records evidence, not a verdict.
