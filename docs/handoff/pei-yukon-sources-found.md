# Prince Edward Island and Yukon — both source blockers are cleared

**2026-10-01.** These were the last two in-scope Canadian jurisdictions with no
certified rule, and both were blocked on REACHING the authority rather than on
encoding it. Both routes are now open. Neither required bypassing anything.

Nothing is encoded yet. This records the routes and the facts established, so the
next session starts from a retrieved instrument instead of a search.

---

## Prince Edward Island — the seasons instrument is located and verified

**`https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-6-wildlife_conservation_act_hunting_and_trapping_seasons_regulations.pdf`**

HTTP 200, **834,466 bytes, 5 pages**, sha256
`c805b7d413030784730cfd74901e53873303db76abe4e0f7a282fad0fdb17613`,
last-modified 2022-09-02. Independently re-retrieved and quoted by a second agent
before being recorded here.

**The slug is `w04-1-6-`.** The Hunting Regulations are `w04-1-5-` and the Act is
`w-04-1-`. The earlier note predicted the numbered-sibling pattern; this is the
next number. It was never going to be found by guessing off the Act's slug.

**Why it was missing.** The Hunting Regulations consolidation contains the word
"season" zero times — seasons are a separate instrument made under **s. 28 of the
Wildlife Conservation Act**. Its enacting words: *"Pursuant to section 28 of the
Wildlife Conservation Act R.S.P.E.I. 1988, Cap. W-4.1, Council made the following
regulations: 1. Open seasons and limits for hunting"*.

### What it carries

**Schedule I — hunting seasons and limits** (game animal, open season, daily,
possession): Pheasant *No open season*; Ruffed Grouse 26 Sep – 31 Dec, 3/6;
Hungarian (Grey) Partridge 15 Oct – 15 Nov, 3/6; Snowshoe Hare 1 Oct – 31 Mar,
5/–; Fox 1 Nov – 31 Jan; Raccoon 1 Oct – 31 Mar; Coyote 1 Oct – 31 Mar; Red
Squirrel *No closed season*.

**Schedule II** — American crow, *No closed season*. **Schedule III** — trapping
seasons, four of them opening at **8:00 AM** on 1 November. **Schedule IV** — a
beaver restricted zone, described in metes and bounds with no coordinates.

### Four things not to lose when encoding it

1. **A material geographic exception, s. 1(2):** *"The open season set out in
   Schedule I for hunting Hungarian (grey) partridge does not apply in Lots 1 to 10
   and Lots 43 to 47 of Prince Edward Island."* PEI is served at geography level
   JURISDICTION because it publishes no hunting units — but this rule is
   sub-jurisdictional. Lots are PEI's historic land divisions. Encoding partridge
   as province-wide would be wrong.
2. **Method-by-date restrictions**, s. 2(3) fox and s. 2(4) coyote: the lawful trap
   type CHANGES mid-season (modified foot-hold traps 1–14 November; snares and
   modified foot-hold traps 15 November – 31 January). One row, two method
   envelopes, by date.
3. **The schedules have DIFFERENT amendment chains and must not be collapsed.**
   Schedule I: EC592/16; 523/17; 571/18; 650/19; 579/20; 763/21; 654/22.
   Schedule III: EC592/16; 523/17; 571/18; 650/19; 654/22 — no 579/20, no 763/21.
   Schedule II: EC650/19. s. 1(3): EC592/16; 650/19; 579/20.
4. **It composes with the Fur Harvesting Regulations (EC663/04).** s. 2(2) makes
   Schedule III subject to them, and s. 2(1) defines "modified foot-hold trap" by
   reference to their clause 6(1)(e). Trapping is a separate activity from hunting
   (§16) and that instrument is not yet retrieved.

### Two cautions

- **It is an OFFICE CONSOLIDATION, not the official version.** Its own page 2:
  prepared by the Legislative Counsel Office, *"intended for information and
  reference purposes only… not the official version"*. Primary-government
  publication on the official domain; record it as such and not as the enacted text.
- **CURRENCY IS UNRESOLVED BEYOND 2022-09-03.** Every page footer reads "Current
  to: September 3, 2022" and the server's last-modified is 2022-09-02, so it has
  not been republished in four years. Whether any Order in Council has amended
  these schedules since could NOT be established, because the only index route is
  `/en/legislation/`, which is closed (below). **Do not certify 2026 seasons from a
  2022 consolidation without resolving this** — it is the `check-currency-before-
  comparing` failure waiting to happen, and the 2024 Summary already proves one
  post-2020 amendment exists (Sunday hunting).

### CURRENCY: every permitted route is now exhausted, and this needs the owner

*Attempted 2026-10-06. Do not repeat these.*

The instrument is **byte-identical to five days earlier** — `content-length:
834466`, `last-modified: Fri, 02 Sep 2022 13:23:47 GMT`, `etag: "631203e3-cbba2"`
— so the consolidation has not been republished in four years. That is consistent
with "nothing has amended it" and equally consistent with "the publisher is
behind", and it distinguishes neither.

What was tried, and what each returned:

- **A newer consolidation at the same URL** — none; the URL is overwritten in
  place and still serves the 2022 edition.
- **The 2024 Hunting Summary, as a cross-check** — HTTP 200, still
  `last-modified: Thu, 22 Aug 2024`, so PEI has not published a newer one there
  either. And it is an **IMAGE-ONLY PDF with no text layer**: both a stream
  decode and a markdown conversion returned no species names. The obvious
  cross-check — do the 2024 Summary's dates match the 2022 schedules? — cannot be
  machine-read. It would need OCR or a person.
- **A gazette or regulation index on the permitted PDF paths** — six candidate
  filenames, all 404.
- **`/en/topic/hunting` in a real browser.** Worth being exact about this one,
  because the record previously named `/en/legislation/` as the closed route and
  the closure is broader. `robots.txt` disallows `/en/search/` and does NOT
  disallow `/en/topic/` or `/sites/default/files/`, so the REQUEST was permitted.
  The site itself then **redirected into `/en/search?fulltext=hunting`** — the
  disallowed path — and the Radware bot manager challenged there, logging a second
  incident against this IP (2026-10-06 12:38:35 UTC). §44 forbids following into
  a robots-disallowed path and forbids solving the CAPTCHA, so the tab was closed
  and nothing further was attempted.

**So the whole HTML site funnels into the disallowed search path**, not merely the
legislation browser. Anyone working PEI next will reach for the topic page, which
is why this is recorded rather than left as a surprise.

**Under §44 the one remaining fallback is "a manually reviewed authoritative
snapshot with provenance", which requires a person.** That is an owner decision,
not something to route around.

### Why PEI is deliberately NOT encoded yet

The seasons could be encoded from the 2022 text today. They are not, and the
reason is §8's capability rule rather than caution.

A bundle whose `certifiedPeriod` ends at 2022-09-03 answers every present-day
query `NEEDS_VERIFICATION` — the engine refuses a date outside the period and
will not state a season. Its rules could never fire. Encoding them would add rule
counts and species counts to the coverage report while delivering no answer to any
hunter, which is precisely what "capability reporting measures deliverable
answers" forbids.

The alternative — setting the period to cover 2026-27 — would present four-year-old
schedules as the law in force. That is the direction that gets someone charged,
and §62 puts human safety first.

So PEI stays uncertified with a named blocker: **the instrument is in hand and
quoted; its currency is unresolved; the unblock is an acquisition decision for the
owner.** When currency is resolved, everything needed to encode it is already in
this document.

### The closed route, still closed

`/en/legislation/<slug>` remains a soft-404 shell (every path returns exactly
125,534 bytes) redirecting into `/en/search/`, which is `Disallow`ed in
robots.txt, and a real browser there produced a Radware CAPTCHA with an incident
logged. **Not to be retried in any form.** The PDF directories
`/sites/default/files/legislation/` and `/sites/default/files/publications/` are
permitted and are where everything above came from.

---

## Yukon — the regulation is reachable in an ordinary browser

**The automated client is refused and a browser visitor is served.** Those are two
different facts and only the first was known.

**What was proven about the refusal**, with negative controls rather than assumed:

- The 403 is **host-wide and fires BEFORE path resolution**. A deliberately
  nonexistent path (`laws.yukon.ca/this-path-certainly-does-not-exist-...pdf`)
  returns the same challenge as a real one, so the challenge is not evidence about
  any path.
- **No official alternate host exists.** Eleven official document-serving hosts
  were tested; direct PDF paths do not serve either, across six specific paths.
- **Byte count does not discriminate here**, unlike PEI: Yukon's interstitial
  embeds the request path, so its length varies (5,314–5,599 bytes observed).
  A size-based hit test would give false positives.

**The route that works**, and it is the one §44 names: *browser-rendered retrieval
within the site's normal public access*. Loading the regulation in the built-in
browser as an ordinary visitor returned **HTTP 200**:

```
https://laws.yukon.ca/cms/images/LEGISLATION/SUBORDINATE/2012/2012-0084/2012-0084.pdf
```

Tab title "Wildlife Regulation" — O.I.C. 2012/84, the instrument whose schedules
carry the seasons. No CAPTCHA was presented and nothing was bypassed; Cloudflare's
interstitial is designed to pass a real browser, and it did.

**This does not make Yukon encoded.** What it establishes is that the regulatory
lane is a reading job rather than an access problem. Still to do: read O.I.C.
2012/84's schedules, establish its amendment chain and the date it is current to,
and record the §44 rights separately — the refusal of our automated client bears
on `accessState` ONLY and says nothing about `reuseState`, `archiveState` or
`derivedFactsState`.

**The Hunting Regulations Summary is a summary and is not the authority.**

### Yukon is fully readable, demonstrated end to end (2026-10-06)

The route is reproducible five days on — HTTP 200 for the same URL — and the
instrument is **machine-readable**, which was the open question. Structurally it
is a text PDF, not a scan: 41 embedded fonts, 136 Flate streams, 3 images and one
JPEG (a crest).

**The method, because `curl` cannot do this and must not be made to.** The shell
client is refused host-wide by Cloudflare; the browser is served. So: load the PDF
in the built-in browser, then in that page's context `fetch(location.href,
{credentials:'include'})` and parse the bytes with pdf.js imported from cdnjs.
Nothing is bypassed — the browser passed the challenge as an ordinary visitor and
the fetch reuses that same session. **Do not instead send a browser User-Agent
from the shell**: that is impersonating a browser to defeat a bot challenge, which
§44 forbids.

Verified output, page 1: `WILDLIFE ACT / LOI SUR LA FAUNE / WILDLIFE REGULATION /
RÈGLEMENT SUR LA FAUNE / O.I.C. 2012/084 / Effective Date: May 11, 2012`.

**The map, so the next session starts from one rather than a search** (99 pages):

| what | pages |
| --- | --- |
| Table of contents | 7 |
| Hunting-hours-shaped text | 15 |
| Schedules begin | 70 |
| **SCHEDULE B — OPEN SEASONS** | **72–82** |
| Bag limits (operative sections) | 19, 21, 29, 64 |

**Schedule B is shaped almost exactly like North Ground's model.** Its columns
are: *Species or Type and class of licence holder | Bag limit | GMZ or GMS in
which hunting of the species or type is permitted | Times during which hunting of
the species is permitted.* That is species × licence class × geography × dates ×
limits in one table — the same five dimensions the conditional engine takes. The
first row reads: `Polar bear — a holder of a seal for polar bear — 1 for each seal
— 1-01, 1-04, 1-05, 1-12 to 1-14`.

**The geography is GMZ/GMS**, Game Management Zones and Subzones — which is the
geography North Ground already holds parity-certified for Yukon. Seasons and
boundaries will join without new spatial work.

**It is bilingual, in parallel.** English and French in the same document, both
published by the authority. Under §47 and §41A both are authority text: the French
is not a translation of ours and must never be labelled `NORTH_GROUND`.

**Currency: 13 distinct O.I.C.s are cited, the latest from 2022** (2022/29,
2022/30, 2022/61). So the consolidation incorporates amendments through 2022 and
the same question PEI has applies here — with one decisive difference: **this
document can be read**, so its own amendment annotations are available and the
question is answerable rather than blocked.

**One trap, flagged before anyone falls into it.** The sunrise/sunset text on
page 15 reads "plainly visible from a distance of 100 metres during the period
commencing one hour before sunrise and ending one hour after sunset". That is a
VISIBILITY definition, not established as the legal hunting-hours rule, and a
one-hour offset read off it would be exactly the inference that produced the
hour-late windows in three provinces. Establish which provision states the hours
before encoding any offset, and remember §44's sibling lesson: a heading is not a
provision.

---

## What this changes in the coverage story

PROJECT-STATE said both jurisdictions were "blocked on reaching the authority's own
instrument rather than on encoding it". That was true this morning. For Prince
Edward Island the instrument is now in hand with its contents quoted, and for Yukon
the route is open. Neither is a licence finding and neither is a modelling problem.

The honest remaining statement for both: **nothing is certified yet, and the next
step is reading rather than searching.**
