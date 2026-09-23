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

> **UPDATE, 2026-09-23, and it widens the question.** Q2 now has a documented
> answer, and it was not on legisquebec. The governing notice is
> **`https://www.quebec.ca/droit-auteur`**, it names **« des lois et
> règlements »** explicitly, it prohibits reproducing, **downloading and
> storing** without prior authorisation, and it has **no exception**
> (section 2).
>
> **It is a quebec.ca notice, so it covers the source we already ingest.** The
> live question is therefore not "may we add legisquebec" but **"what
> authorises what we already do"** — see section 2.4 for what the shipped
> bundle holds. That is a question for the owner and, on their own stated
> standard, probably for counsel.

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

## 0.5 What a "no" actually costs, per item — the asymmetry is the decision

Measured in section 6, not assumed. **The two gated items are not in the same
position, and that is the most decidable fact in this package:**

| Gated item | If we may not use the Règlement | Route that remains |
|---|---|---|
| **Gear classes** (`scope.gearClasses`) | **Unobtainable, full stop.** | **None.** `engin de type` appears **0 times** across all five quebec.ca pages we ingest. The ministry publishes the equipment; only the Règlement publishes the numbered identity. |
| **The art. 17 anchor** | No independent anchor | The build stays correct and guarded by MFFP's summary prose — a single anchor rather than two. |
| **Québec legal hours** | Falls back, does not vanish | **Partial: 1 of 10 species.** quebec.ca publishes turkey's hours and **we already carry them**. |

**So a "no" costs everything for gear classes and costs nine-tenths for hours.**
One has no route at all; the other has a narrow existing one.

And the cost is not proportional to the rule counts (section 5): the gear-class
gap is a **safety** gap, because the hunter-orange exemption reaches engin types
6 and 11 and **not** 12, and those are indistinguishable from an implement list.

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

## 2. The terms — **FOUND, and restrictive**

*Resolved 2026-09-23. This section previously read "NOT ESTABLISHED, and the
absence is uncontrolled". It is kept in the history because the search that
closed it is the reason the finding below was found at all.*

### 2.1 Where they were — not on legisquebec

| Page | Result |
|---|---|
| `/fr/document/rc/c-61.1, r. 12` (the regulation, 776,835 bytes) | publisher name and "Ce document a valeur officielle." Only `reproduction` match was substantive text about decoys. |
| **`/fr/contenu/mjqpol`** — Politique du ministre de la Justice | Consolidation, classification, citation, update notes. **Does not address reproduction**: 0 hits for droit d'auteur, reproduction, copyright, licence, commercial. Its only "utilisation" is « d'utilisation courante ». |
| **`/fr/contenu/editeurofficiel`** — L'Éditeur officiel du Québec | Purely historical. 0 hits on the same terms. |
| `robots.txt` | Section 3. |

legisquebec's footer carries **« © Gouvernement du Québec »** and links to
Québec.ca. It has **no conditions-of-use page of its own**, so the governing
notice is site-wide.

### 2.2 The governing notice, verbatim

**`https://www.quebec.ca/droit-auteur`** — "Droit d'auteur et demande
d'autorisation de reproduction", last updated **10 February 2025**:

> « Le gouvernement du Québec détient les droits exclusifs de propriété
> intellectuelle sur tous les documents, données, compilations et autres œuvres
> qu'il produit, publie ou diffuse, que ces documents soient des textes
> officiels ou administratifs, **des lois et règlements**, des rapports annuels,
> des brochures, etc. »

> « Il est **interdit de reproduire, télécharger, stocker**, traduire, adapter,
> publier ou représenter en public les contenus du gouvernement du Québec
> **sans autorisation préalable**. »

**Reproduce, download, store.** It names laws and regulations. Searched for a
carve-out — exception, sauf, gratuit, sans frais, libre, licence, non
commercial, court extrait, citation — and **there is none**.

The only route the publisher offers is a **formal authorisation request**: an
online form (`/droit-auteur/demande-autorisation`), about **15 business days**,
`droitdauteur@mcc.gouv.qc.ca`. One request may cover several works. The form
asks for the intended use, the number of copies, and **the person or
organisation to be billed** — so a fee may attach.

### 2.3 In the codebase's vocabulary

No longer `UNRESOLVED`. The publisher's own words restrict use:

    permittedUse:    "RESTRICTED"
    redistribution:  "PROHIBITED"
    attribution:     (not reached — authorisation precedes use)

### 2.4 The part that is not about legisquebec

**The notice is a quebec.ca notice**, and quebec.ca is the source every Québec
rule we ship already comes from. It covers « tous les documents, données,
compilations ». So the committed bundle is in scope, and it holds:

| In `content/regulatory/ca-qc-2026.json` | |
|---|---|
| `seasonPhrase` | 81 distinct, 2,990 chars of verbatim French |
| `zoneLabel` | 51 distinct, 3,216 chars |
| `implementLabel` / `classLabel` / `sourceSection` | 31 distinct, 1,476 chars |
| `statements` | 26 records, 6,041 chars of authority prose |
| `caveats` | 58 quoted exclusions |
| `legalTime` | 1 verbatim sentence (the turkey noon rule) |

**What this package does NOT claim.** Not that North Ground is infringing. Not
whether a blanket web notice binds, how it interacts with the texts being *law*,
whether extracting dates and zone codes into structured data is reproduction of
« documents, données, compilations » or the use of facts, or whether anything in
the Loi sur le droit d'auteur or Québec practice carves out legislative texts.
**Those are legal judgements, and this is the territory the owner said they
would want counsel for.**

**What it does claim, narrowly and with evidence:** there is a published,
explicit, exception-free prohibition on reproducing, downloading and storing
Québec government content without prior authorisation; it names laws and
regulations; it governs **both** Québec sources; and no authorisation has been
obtained.

**Safest posture until this is answered: change nothing, add nothing.** Adding
further verbatim Québec text is the one action that makes the position worse.
Withdrawing shipped answers is also an action and should not be taken on a
reading of a web page — §8's fidelity rule cuts both ways, and a refusal
stricter than the source is a false claim too.

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

## 8. What is still open

Item 2 is closed. What remains is not research:

1. **A decision the owner makes, probably with counsel.** Whether the quebec.ca
   notice binds as written, and how it applies to structured data extracted from
   published regulations, are legal questions rather than research ones. Section
   2.4 states precisely what is claimed and what is not.
2. **The authorisation request, if it is wanted.** The publisher specifies the
   route: `/droit-auteur/demande-autorisation`, ~15 business days, one request
   may cover several works, billing contact required. It would resolve
   legisquebec **and** quebec.ca together. **Not to be sent by an agent** — it
   names a billing party and commits North Ground.
3. **Record the outcome as a `SourceLicence`** — `statedAs`, `url`,
   `retrievedAt`, `sha256`, `permittedUse`, `redistribution`, `attribution` — so
   a reworded notice later shows up as a visible change rather than a silent
   one. Today's honest values are in section 2.3.
4. **Q1 is still unanswered and is separable.** Nothing found addresses
   automated retrieval or user-agents; the quebec.ca notice is about *use*, not
   *access*. Section 3 is the evidence, and section 7 is what each combination
   permits.

**Changed in this revision:** section 2 previously reported the terms as
NOT ESTABLISHED with an uncontrolled absence. Reading the ministerial policy —
where terms would be, and where they are not — is what led to the site-wide
notice that does contain them. **The absence was the finding that produced the
answer**, which is the argument for controlling absences rather than reporting
them.

This records evidence, not a verdict.
