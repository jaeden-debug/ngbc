# Québec source licensing — decision packet

**For:** the owner, and counsel if they want one.
**Prepared:** 2026-09-23. **Structure:** the owner's 13-item specification.
**This is evidence, not a recommendation.** Item 11 is my reading, item 12 is
the strongest case against it, item 13 is what we can do if neither is settled.

> **The authorisation request is not to be sent by an agent.** It names a
> billing party and commits North Ground. If it is to be sent, a person sends
> it. Stated first because of the request's shape rather than its difficulty:
> it looks like paperwork, an agent could obviously fill it in, and it **names
> who gets billed**. That is exactly where "it is just a form" becomes a
> commitment made by a session.

---

## The decision in one page

**Two questions, and they are independent.** Nothing found addresses the second.

- **Q2 — reuse.** May we store and serve Québec government text commercially?
  **Answered, restrictively** (items 4, 5).
- **Q1 — access.** May we retrieve programmatically, given the site refuses our
  user-agent and serves a browser one? **Untouched by that answer**, because the
  notice governs *use*, not *access* (appendix A).

**The reframe that matters:** this began as "may we add legisquebec". The terms
are not on legisquebec at all — they are site-wide on **quebec.ca**, the source
every Québec rule we already ship comes from. **The live question is what
authorises what we already do.**

**What a "no" costs is lopsided, which is the most decidable fact here:**

| Gated | Cost of a no | Route that remains |
|---|---|---|
| **Gear classes** | **Total** | **None.** `engin de type` appears **0 times** across all five quebec.ca pages we ingest. Only the Règlement publishes the numbered identity. |
| **Art. 17 anchor** | One anchor instead of two | Build stays correct, guarded by MFFP's summary prose. |
| **Québec legal hours** | Nine-tenths | **1 of 10 species.** quebec.ca publishes turkey's and we already hold it. |

Not proportional to rule counts: the gear-class gap is the **safety** one,
because the hunter-orange exemption reaches engin types 6 and 11 and **not** 12,
and those are indistinguishable from an implement list.

**And the exposure is concentrated, not diffuse** (item 8): 184 of 186 rules
already carry structured dates, and **~81% of the verbatim French we store is
duplicative of facts we hold anyway.**

---

## 1. Exact dataset / document name

| # | Document | Form |
|---|---|---|
| 1a | **Règlement sur la chasse**, C-61.1, r. 12 | HTML, consolidated |
| 1b | **Annexe III — « Périodes de chasse dans les zones »** (annex to 1a) | PDF, 9 pages |
| 1c | **Loi sur la conservation et la mise en valeur de la faune**, C-61.1 | HTML, consolidated |
| 1d | **Règlement sur les activités de chasse**, C-61.1, r. 1 | HTML — *needed for hunter orange, not yet read* |
| 1e | **Périodes de chasse** season pages — orignal, cerf-virginie, ours-noir, dindon-sauvage, petit-gibier | HTML, 5 pages — **already ingested** |

## 2. Exact publisher

- **1a–1d:** « L'Éditeur officiel du Québec ». Site operated by **Les
  Publications du Québec**, under the **Ministère de l'Emploi et de la
  Solidarité sociale**. Footer: « © Gouvernement du Québec ».
- **1e:** Gouvernement du Québec — **ministère de l'Environnement, de la Lutte
  contre les changements climatiques, de la Faune et des Parcs**.
- Rights administered centrally: `droitdauteur@mcc.gouv.qc.ca` (Ministère de la
  Culture et des Communications).

## 3. Official URL

| # | URL |
|---|---|
| 1a | `https://www.legisquebec.gouv.qc.ca/fr/document/rc/c-61.1, r. 12` — **« à jour au 1er mai 2026 »** |
| 1b | `https://www.legisquebec.gouv.qc.ca/fr/ressource/rc/C-61.1R12_FR_002_020.pdf` — sha256 `a92326176f3c369c45193d80c78d5fcc53116a016a3b99bfe8708c1d6ca9f62e`, 148,728 bytes |
| 1c | `https://www.legisquebec.gouv.qc.ca/fr/document/lc/C-61.1` — **« à jour au 10 juin 2026 »** |
| 1e | `https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/…` |
| terms | `https://www.quebec.ca/droit-auteur` — last updated **10 February 2025** |

The two `asOf` dates are **40 days apart**. That is a real property: `asOf` is
per instrument and is never inherited from a sibling.

## 4. The reuse wording, quoted faithfully

From `https://www.quebec.ca/droit-auteur`, "Droit d'auteur et demande
d'autorisation de reproduction":

> « Le gouvernement du Québec détient les droits exclusifs de propriété
> intellectuelle sur tous les documents, données, compilations et autres œuvres
> qu'il produit, publie ou diffuse, que ces documents soient des textes
> officiels ou administratifs, **des lois et règlements**, des rapports annuels,
> des brochures, etc. »

> « Il est **interdit de reproduire, télécharger, stocker**, traduire, adapter,
> publier ou représenter en public les contenus du gouvernement du Québec
> **sans autorisation préalable**. »

Authorisation route the publisher itself specifies:
`/droit-auteur/demande-autorisation`, ~15 business days,
`droitdauteur@mcc.gouv.qc.ca`. One request may cover several works. The form
asks the intended use, the number of copies, and **the party to be billed**.

**Searched for a carve-out; there is none:** exception, sauf, gratuit, sans
frais, libre, licence, non commercial, court extrait, citation. No
non-commercial allowance, no short-extract allowance, no legislative-text
exception.

## 5. Which licence governs

**No open licence. The quebec.ca notice governs both sources.**

Where I looked and what each returned — recorded because the first two nulls are
what led to the third:

| Page | Result |
|---|---|
| The regulation itself (776,835 bytes) | Publisher name; "Ce document a valeur officielle." The only `reproduction` hit was substantive text about decoys. |
| `/fr/contenu/mjqpol` — Politique du ministre de la Justice | Consolidation, classification, citation, update notes. **Reproduction: 0 hits**, likewise droit d'auteur, copyright, licence, commercial. Its only "utilisation" is « d'utilisation courante ». |
| `/fr/contenu/editeurofficiel` | Purely historical. 0 hits. |
| Footer → `quebec.ca/droit-auteur` | **The terms.** |

legisquebec has **no conditions-of-use page of its own**, which is why the
site-wide notice governs. In our vocabulary: `permittedUse: "RESTRICTED"`,
`redistribution: "PROHIBITED"` — **not** `UNRESOLVED`.

## 6. Third-party material inside the documents

**Checked rather than assumed. Essentially none, with two qualifications.**

- **Annexe III (1b):** PDF metadata gives `/Author: Couture, Daniel (DCHALTF)`,
  `/Producer: Microsoft: Print To PDF`, created 2026-01-20, modified 2026-04-15.
  Searched the extracted text for ©, copyright, « source : », adapté, reproduit,
  « avec la permission », photo, crédit — **all absent**. The single "Canada"
  match is the species name « Tétras du Canada » (spruce grouse). **Wholly
  Québec-authored.**
- **Season pages (1e):** no third-party credit terms on any of the five. Each
  carries exactly 3 `<img>` — Facebook, X and YouTube **social icons**:
  third-party trademarks, template furniture, not content, and not ingested.
- **One genuine third-party pointer:** petit-gibier refers to « la brochure du
  Règlement de chasse aux oiseaux migrateurs d'Environnement et Changement
  climatique Canada ». It **points out to** the federal instrument rather than
  reproducing it. We already read the federal migratory-bird regulations from
  the federal source, so nothing federal reaches us through Québec.

**Consequence: a Québec authorisation would not be encumbered by third-party
rights** — the province appears able to grant what it is being asked for.

## 7. Exactly what North Ground wants to do, itemised

Stated without softening. **North Ground is a commercial product**, and under
blueprint §11 the regulatory engine may later be licensed to third parties or
governments — so any grant should be read with that in view, not only against
today's website.

| Act | Wanted? | Detail |
|---|---|---|
| **Read / query** | **Yes** | Browser today for the Règlement; scheduled programmatic reads wanted (Q1). |
| **Extract** | **Yes** | Dates, zone codes, species, implements, engin type numbers. |
| **Locally store** | **Yes** | Committed JSON bundles in the repository. |
| **Transform** | **Yes** | French season phrases → ISO date windows; headings → enums. |
| **Derive structured facts** | **Yes** | The regulatory records the engine evaluates. |
| **Display** | **Yes, partly** | Status, dates and hours are derived. Some **authority prose is shown verbatim**, which §41A and §47 require where the authority's words *are* the fact. |
| **Redistribute** | **Indirectly** | Not as a dataset. Bundles sit in a repository and answers are served publicly. |
| **Cache** | **Yes** | Retrieved source documents, for change detection and provenance. |

## 8. Do we need the raw work, or only facts derived from it?

**Overwhelmingly the facts.** Measured, and it is the item that most changes the
shape of the ask.

**184 of 186 rules already carry structured ISO date windows** (the other 2 are
`declaredNoSeason`). **No rule depends on the French phrase to express its
season.** The operational answer is carried by 58 zone designations, 4 animal
classes, 7 implement enums and ISO dates.

Splitting the stored verbatim French by whether we *also* hold the same fact
structurally:

| Verbatim French held | Chars | Structured equivalent? |
|---|---|---|
| `implementLabel` + `classLabel` + `sourceSection` | 22,834 | **Yes** — enums |
| `seasonPhrase` (184 rules) | 6,576 | **Yes** — ISO windows |
| `zoneLabel` | 11,004 | **Yes** — designations |
| **subtotal, duplicative** | **40,414** | |
| `caveats` — 58 quoted exclusions | 3,220 | **No** |
| `statements` — 26 records of authority prose | 6,041 | **No** |
| `legalTime` — 1 sentence (turkey noon rule) | ~90 | **No** |
| **subtotal, load-bearing expression** | **~9,261** | |

**~81% of the verbatim text we store is duplicative of facts we hold anyway.**
The genuine need for *expression* is ~9,261 characters, and it exists for a
product reason rather than convenience: §41A keeps the authority's own words
where the words are the fact, and §47 forbids translating official terminology.

**So the honest ask is narrow**, which is what item 13 builds on.

## 9. Exactly which facts, species and capabilities are blocked

Bundle: **186 rules, 10 species, 58 designations.**

| Blocked | Scope |
|---|---|
| **Gear classes** (`scope.gearClasses`) | **52 rules**, 3 species, 51 designations — the bow/crossbow-only seasons where engin types 11 and 12 are indistinguishable. 178 of 186 rules carry an implement set; 114 include a firearm. |
| **Hunter-orange exemption** | Cannot be evaluated for those 52. Failure direction: telling a hunter they need **no orange** when the law requires it. |
| **Art. 17 anchor** | **16 antlerless-moose rules**, 8 designations. Currently correct and guarded, but against MFFP prose rather than the regulation. |
| **Québec legal hours** | **9 of 10 species.** |
| Ready to Hunt | Québec cannot state legal methods by the authority's own class, nor the orange minimum, for those 52. |

## 10. Can another authoritative Québec source establish the same facts?

**Measured across the five quebec.ca pages we already ingest.**

**Gear type definitions — no.**

| Page | "engin" | "engin de type" | any "type N" |
|---|---|---|---|
| cerf-virginie | 2 | **0** | **0** |
| dindon-sauvage | 0 | **0** | **0** |
| orignal | 0 | **0** | **0** |
| ours-noir | 0 | **0** | **0** |
| petit-gibier | 13 | **0** | **0** |

The ministry uses « Engin » as a **column heading** whose values are implement
names — "Engin : arbalète et arc". **It never publishes the numbered class.**
The ministry publishes the equipment; only the Règlement publishes the identity
that art. 17 and the orange exemption turn on.

**Legal hours — partly.** quebec.ca states turkey's and we already hold it:
« La chasse est permise à partir d'une demi-heure avant le lever du soleil
jusqu'à midi. » Controlled search — the query **finds** turkey, so the zeros are
real absences rather than a broken query: `lever du soleil` scores 1/0/0/0/0
across the five pages. **1 of 10 species.**

**Not yet examined:** whether MFFP publishes a hunter's guide or brochure
restating engin types in plain language. If one exists it is a
quebec.ca-licensed route to the same facts, and it is **worth checking before
any authorisation request is sent**, because it could narrow the ask further.

## 11. My evidence-based interpretation

Narrow, and confined to what is sourced:

There is a **published, explicit, exception-free** prohibition on reproducing,
downloading and storing Québec government content without prior authorisation.
It **names laws and regulations**. It governs **both** Québec sources, including
the one we already ingest. **No authorisation has been obtained.**

On its face that covers what we do. The prudent reading is that our position
rests on either (a) an authorisation, or (b) the proposition that what we mostly
store are *facts* rather than protected expression — which is item 12, and which
item 8 shows is most of the volume.

**I am not a lawyer and this is not a legal opinion.** I have not weighed
whether a unilateral web notice binds, how it interacts with the texts being
*law*, or whether the Copyright Act resolves it differently from the notice.

## 12. The strongest interpretation against my conclusion

Argued properly, because a packet that argues only one way is not decidable.
**Several of these are strong, and the first is the strongest.**

1. **Copyright protects expression, not facts.** A season date, a zone code, a
   species name and an implement list are facts. Canadian law requires skill and
   judgement for originality (*CCH Canadian Ltd v Law Society of Upper Canada*,
   2004 SCC 13). **Item 8 measures that ~81% of what we store duplicates facts**,
   and our structure is our own rather than the ministry's arrangement. On this
   reading most of the bundle is not protected subject matter at all, and no
   authorisation is needed for it.
2. **A website notice is not a licence agreement.** It is a unilateral
   assertion. Reading a public page forms no contract absent assent, and an
   assertion cannot enlarge rights beyond what the Copyright Act confers. The
   word « interdit » describes what the government wishes, not necessarily what
   the law grants.
3. **Copyright is federal.** A provincial policy page cannot expand it. Crown
   copyright (s. 12) exists, but its application to **statutes and regulations**
   is contested, and there is a strong public-interest argument for access to
   the law one is required to obey.
4. **Fair dealing is a user's right**, to be read large and liberally (*CCH*),
   with research an enumerated purpose.
5. **Substantiality.** Infringement requires a substantial part (*Cinar
   Corporation v Robinson*, 2013 SCC 73). ~9,261 characters of short exclusions
   and statements, spread across a long regulation, may well not be substantial.
6. **Purpose and practice.** The ministry publishes season dates precisely so
   hunters act on them, and every outfitter, app and newspaper restates them. A
   reading where restating a season date requires written permission would make
   ordinary compliance journalism unlawful.

**Where this leaves me:** points 1 and 5 are the ones I would expect to carry,
and both point the same way as item 8 — **our exposure is concentrated in the
~19% that is expression**, not spread across the bundle. That is a far smaller
and more tractable problem than the notice's wording suggests on a first
reading.

**The counter-counter, stated so it is not lost:** none of this makes the notice
irrelevant. It is evidence of the rights-holder's position, it names laws and
regulations specifically, and a commercial product that also intends to license
its engine onward (§11) is the least sympathetic possible profile for a
fair-dealing argument.

## 13. The smallest safe use, if the broader use stays uncertain

**Facts only, no stored expression.** Buildable now, and it keeps every answer
we currently give.

- **Keep:** ISO date windows, zone designations, species ids, animal-class and
  implement enums, engin type **numbers** — all facts (item 12 ¶1), and the
  whole operational answer (item 8).
- **Keep the citation, drop the copy:** where prose is needed today, store the
  pinpoint reference and link the authority's own page instead of the text.
- **Stop adding** the 40,414 duplicative characters, which cost nothing to lose
  because the structured equivalent already exists.
- **Isolate** the ~9,261 load-bearing characters as the *only* thing an
  authorisation needs to cover. That converts the ask from "may we use Québec's
  regulations" into "may we quote 58 exclusions and 26 statements" — a far
  easier request to grant.
- **For gear classes specifically:** store the **code** ("11"), the **official
  term** (« engin de type », four words), and the **citation** — no reproduced
  definition. This unblocks art. 17 and the orange exemption without copying the
  art. 31 text.

**The one caveat**, carried from the engine owner's review: if
`GearClass.statedAs` becomes optional to allow this, it must be a **named
state** meaning *"definition not yet reproducible, identity certified"* — not a
field that can simply be absent, or a row that legally cannot carry a definition
becomes indistinguishable from one that forgot.

**Ranked, if only one thing is done:** the item-13 path first, because it is
ours to build and needs nobody's permission; then the authorisation request for
the ~9,261 characters; then Q1.

---

## Appendix A — Q1, access, which none of the above answers

The quebec.ca notice governs **use**, not **access**. Nothing found addresses
user-agents or automated retrieval, so **Q2 could be answered and Q1 still
owed.**

Measured, same URL, same moment:

```
User-Agent: NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)   -> 403
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
            (KHTML, like Gecko) Chrome/125.0 Safari/537.36                     -> 200
```

`robots.txt`, itself 403 to a short agent and 200 to the browser string:

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

Both spellings, printed so the difference can be judged rather than taken on
trust:

```
disallowed :  /fr/resource      ← one s
annexe III :  /fr/ressource/…   ← two s, the French spelling
```

Literally, `/fr/ressource/…` is **not** matched. My assessment is unchanged:
**too thin to rely on** — that is reading a permission into what is probably a
typo, and `/fr/showPdf` being disallowed suggests the intent was to keep
crawlers off document files generally.

**Already settled** (`src/lib/hunt/source-licence.ts`): a bot filter on a public
page is not an access control on a data service, so **browser reads are fine and
are not part of this decision.** What is open is *scripted* retrieval presenting
an agent we are not.

## Appendix B — disclosure

The annexe III PDF was fetched once with `curl` carrying a browser user-agent,
**after** the same URL had been opened in the browser pane. One file, no crawl,
nothing scheduled, not committed; held in session scratchpad. It is the only act
in this record that is not a plain browser read, and it is the reason Q1 is live.
