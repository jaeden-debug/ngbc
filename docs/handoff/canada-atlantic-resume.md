# Atlantic Canada regulatory lane — resumption note

**Written 2026-09-30 on hitting a usage limit.** Prince Edward Island is derived far
enough to build; Nova Scotia and Newfoundland and Labrador are not started beyond
the URL check. Read this before re-fetching anything, because two of the findings
below cost real time to establish and one of them is a hard stop.

The reference implementation is Manitoba (`content/regulatory/ca-mb-2026.json`,
built by `scripts/build-manitoba-regulations.mjs`). Its discipline, which the rest
must match: built from the **codified regulation** rather than the guide, an
`absence` block quoting the authority's own "silence means closed" provision, a
`certifiedPeriod` narrower than the licence year where the consolidation came into
force mid-year, and a `crossCheck` against the guide that records DISPUTE entries
rather than resolving them.

Registering a bundle touches four places: the builder, the bundle JSON,
`src/lib/hunt/regulatory/<province>.ts`, and both
`src/lib/hunt/canada/registry.ts` (`bundleIds`) and
`src/lib/hunt/readiness/completeness.ts`.

---

## The URL check, run first as asked

38 Canadian URLs, 36 answered. Both failures are bot challenges rather than dead
links, and only one is in scope:

**Yukon's legislation is behind a Cloudflare challenge on three hosts.** `yukon.ca`,
`laws.yukon.ca` and `legislation.yukon.ca` all return HTTP 403 with "Just a
moment...", and it is the HOST rather than a path — `yukon.ca/`, `/en` and
`/en/hunting-regulations` all 403 at 5.4–5.5 KB. Its DATA hosts answer normally:
`open.yukon.ca` 200 at 30,668 bytes, `mapservices.gov.yk.ca` 200. Yukon publishes
its geography openly and challenges its law, which is exactly why its spatial lane
is VERIFIED and its regulatory lane empty.

All three Atlantic provinces read: `novascotia.ca/natr/hunt/regulations/` 200 at
17,133 bytes, `princeedwardisland.ca/en/topic/hunting` 200 at 125,534,
`gov.nl.ca/hunting-trapping-guide/` 200 at 25,201. Saskatchewan and New Brunswick
answer too. Nunavut's 403 is out of scope under §9.

---

## Prince Edward Island

### The instrument, and the filename that wasted eight probes

**`https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-5-wildlife_conservation_act_hunting_regulations.pdf`**
— HTTP 200, 1,026,059 bytes, 11 pages.

The slug is **`w04-1-5-`**. The Act's is `w-04-1-`
(`w-04-1-wildlife_conservation_act.pdf`, HTTP 200, 861,618 bytes). I guessed eight
filenames off the Act's pattern and every one 404'd; **the correct URL was already in
the repository**, in `src/lib/hunt/ingestion/prince-edward-island.ts`. Grep the tree
before probing a government file server.

### CURRENCY: the regulation is six years behind the Act

The regulation states **"Current to: October 3, 2020"**. The Act states "Current to:
May 29, 2026". A 2026 answer cannot rest on the 2020 consolidation without
establishing that nothing since amended it — and the 2024 Summary reports a
substantive change that postdates it (below). **Do not encode these as 2026 rules
until that is resolved.** This is the `check-currency-before-comparing` failure
waiting to happen.

### The species universe, verbatim from Schedule 1 and Schedule 2

Both carry `(EC534/19)`. This is the whole of it — **no deer, no moose, no bear**:

**SCHEDULE 1 — GAME.** "The following species are designated as game:"

| class | species | scientific name |
|---|---|---|
| Furbearer Game | eastern coyote | *Canis latrans* |
| | red fox | *Vulpes vulpes* |
| | raccoon | *Procyon lotor* |
| | red squirrel | *Tamiasciurus hudsonicus* |
| Upland Game | snowshoe hare | *Lepus americanus* |
| | gray partridge | *Perdix perdix* |
| | ruffed grouse | *Bonasa umbellus* |
| | ring-necked pheasant | *Phasianus colchicus* |

**Migratory Game Birds** are not enumerated. Verbatim: "All birds indigenous to the
province and protected under the Migratory Birds Convention Act S.C. 1994, c.22."
So PEI's migratory universe is **defined by reference to federal law**, and it
therefore depends on the `migratoryComplete` milestone, which is unmet.

**SCHEDULE 2 — Harvestable Wildlife.** American crow, *Corvus brachyrhynchos*.

**"Game" and "harvestable wildlife" are two different legal categories** and must not
be collapsed: s. 2(1)(a) prohibits discharging a firearm "in a locality frequented by
game **or harvestable wildlife**", naming them separately. Crow is harvestable
wildlife and is not game.

Red squirrel as furbearer game, and gray partridge, are the entries most likely to be
missing from the species catalogue. Per the moderator: canonicalize through the
species lane with `takeEligibility`, or the rules will be silently unanswerable.

### Legal hours are stated as a PROHIBITION, not a window

s. 2(1)(a), verbatim: no person shall "hunt game or discharge a firearm in a locality
frequented by game or harvestable wildlife during the period from one-half hour after
sunset in any day to one-half hour before the next sunrise".

So the permitted window is half an hour before sunrise to half an hour after sunset —
**derived by inverting a prohibition**, which is a different encoding path from
Manitoba's stated window and should be recorded as such. Two exceptions in s. 2(2):
raccoon at night with a Minister's permit, and a .22 rimfire cartridge at night to
dispatch a furbearer legally harvested under the Fur Harvesting Regulations.

### Ammunition restrictions are species-specific

s. 2(1)(b): no rifle or firearm loaded with a bullet when hunting game **other than**
red squirrel, snowshoe hare, raccoon, fox or coyote. s. 2(3): those same five may not
be hunted with a shotgun loaded with a single bullet, or a rifle larger than .22
calibre. s. 2(4) excepts a muzzle-loader with balls or sabots greater than .22.

Both are **ZONE-scope irrelevant and JURISDICTION-scope conditions** under the
moderator's `condition-scope` rule — PEI has no zones at all, so every PEI condition
is JURISDICTION by construction. That is a genuine simplification here and must not
be generalised to provinces that do have zones.

### THE SEASONS ARE NOT IN THE REGULATION

"close season" and "open season" each occur **zero** times in the 11-page
consolidation. Its sections are: definitions, prohibition re game, offence,
ammunition, interfering with a hunt, prohibition, hunter safety training, instructor,
fee, refusal, condition re licence, prohibition, issuance of certificate, shooting
preserve, offence and penalty, revocation. **No seasons, no bag limits.**

So PEI's season dates live in another instrument, and finding it is the next step.

### What the Summary gives, and why it is not enough

`https://www.princeedwardisland.ca/sites/default/files/publications/hunting_summary.pdf`
— HTTP 200, 3,967,086 bytes, 59 pages — is the **2024 Hunting Summary (2024-2025)**,
not the current one. It says of itself: "The original act and regulations should be
consulted for all purposes of interpreting and applying the law."

It reports a substantive change: an amendment to the Wildlife Conservation Act
**removing the prohibition on Sunday hunting**, "in effect this hunting season" —
which postdates the 2020 regulation consolidation and confirms the currency problem.

Four guessed current-year filenames 404'd (`2026_hunting_summary.pdf`,
`hunting_summary_2026.pdf`, and the 2025 equivalents). The stable URL appears to be
overwritten per year rather than versioned, so the 2024 content at that URL may
simply be stale-in-place.

### PEI's website cannot be read by an automated client, and MUST NOT be worked around

- `/en/legislation/<slug>` paths all return **exactly 125,534 bytes** — including a
  deliberately bogus path — so they are a soft-404 shell, caught by byte count. They
  redirect into `/en/search`.
- **`/en/search/` is `Disallow`ed in `robots.txt`.** Those legislation URLs therefore
  redirect into a robots-disallowed path, and §44 forbids following that. Stop
  requesting them.
- Attempting the same URL in a real browser produced a **Radware CAPTCHA page**
  ("Please solve this CAPTCHA to request unblock"), incident logged against this IP.
  §44 forbids solving it. **That route is closed and is not to be retried.**
- What IS permitted and works: `/sites/default/files/legislation/` and
  `/sites/default/files/publications/`, neither of which is disallowed.

So the remaining authoritative paths for PEI's seasons are the PDF directories, the
Royal Gazette, or an official alternate domain — not the site's own search or
legislation browser.

### §44 source-rights record for PEI, as established

`accessState` PUBLIC_READABLE for the PDF directory and READER_REFUSED for the HTML
site; `reuseState` UNSTATED (no terms located on either PDF); `archiveState`
UNCONFIRMED; `derivedFactsState` USABLE; `authorityLevel` PRIMARY_GOVERNMENT for the
regulation and GOVERNMENT_SUMMARY for the Summary; `retrievalMethod` OFFICIAL_PDF
with OFFICIAL_HTML recorded as the failed first fallback.

---

## Nova Scotia and Newfoundland and Labrador — not started

Both read cleanly, and the spatial registry already carries hard-won findings worth
reading before touching either:

**Nova Scotia** has 12 Deer Management Zones (101–112) parity-certified, and *no moose
or bear geography* — the province licenses only its deer zones as open data, and its
moose zones exist solely on the Provincial Landscape Viewer's ArcGIS service, which
carries no licence of any kind. So NS rules for moose and bear will have geography
North Ground cannot draw. Expect that to be the shape of the NS problem.

**Newfoundland and Labrador** is already three species-scoped layers — 74 moose areas,
19 caribou areas, 7 black bear areas — and the island and Labrador differ again. The
owner's "NL is not one answer" warning is satisfied at the spatial level; it must be
carried into the rules.

A research workflow (`wf_640d8871-a20`) was resumed and may have completed after this
note was written. Check its journal before re-researching:
`~/.claude/projects/-Users-jaedendoody-Desktop-ngbc/1b5bae5f-bb82-474c-8075-3ce1e12b9014/subagents/workflows/wf_640d8871-a20/journal.jsonl`
