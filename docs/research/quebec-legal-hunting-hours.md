# Québec legal hunting hours — research finding

**Status:** research only. This document does not encode anything and is not a
contract. The hours model, its encoding and its UI belong to the milestone
lane; this is the evidence for it.
**Read:** 2026-09-29, from LégisQuébec, French and official English versions.
**Instruments:** Loi sur la conservation et la mise en valeur de la faune
(C-61.1, à jour au 1er mai 2026) · Règlement sur la chasse (C-61.1, r. 12) ·
Règlement sur les activités de chasse (C-61.1, r. 1) · Règlement encadrant la
localisation et l'abattage d'un animal blessé mortellement (C-61.1, r. 18.1).

---

## The answer

**Québec's general legal hunting window is one half hour before sunrise to one
half hour after sunset** — the same window as Ontario, Alberta and Manitoba.

It is not written anywhere as an hours rule. It is the product of two
provisions:

1. **The Act defines "night"** (C-61.1, s. 1, the general definitions article):
   > "night" means the period extending from one half hour after sunset to one
   > half hour before sunrise

2. **The regulation confines night hunting to an enumerated list** (C-61.1,
   r. 12, s. 21):
   > A person may hunt at night provided it is for hare or rabbit using snares,
   > for northern leopard frog, green frog, bullfrog, or for raccoon with a
   > hunting dog.
   >
   > *(fr: « Toute personne peut chasser la nuit que si elle chasse le lièvre ou
   > le lapin au moyen de collets… » — the restrictive `ne…que`; the French
   > consolidation renders it without the "ne", the English is unambiguous.)*

So for every species NOT on that list — all big game, all upland birds — hunting
at night is not permitted, and "night" is defined. The window falls out of the
definition.

**Do not describe this to a hunter as "sunrise to sunset".** The half hour
either side is real and comes from the Act's own definition.

---

## Correction: my 2026-09-23 partial finding was half right, and the wrong half
## would have been harmful

Six days ago I reported a census showing **zero occurrences of « heures de
chasse »** across r. 12, r. 1 and the Act, and concluded Québec was
"prohibition-based rather than window-based", possibly with no general window at
all.

The zero is real and reproducible. **The conclusion drawn from it was wrong**,
and had it been implemented as "Québec states no general hours", every Québec
answer would have shown no legal hours for a jurisdiction that has them.

**Why the method failed, precisely.** I searched for a PHRASE and reported it as
a fact about the CONCEPT. Québec does not legislate hunting time under the words
"heures de chasse"; it legislates it under « nuit ». A search for the first term
cannot find the second, so the zero was guaranteed by the method — it measured
my vocabulary, not the corpus.

**The control I ran was the wrong control.** I checked that hour-phrases were
findable at all (« demi-heure » and « lever du soleil » both hit), and they were.
That proved the search worked; it did not prove the search could have found the
rule, because the rule does not contain those words in its operative part. A
control has to be able to fail for the reason the measurement would fail.

**What actually found it** was a probe rather than a term: reading C-61.1, r. 18.1,
which governs tracking an animal wounded during a hunt. A rule about the *edge*
of hunting time must reference hunting time if the concept exists. It does not
mention hours at all — it grants blood-tracking dog handlers exemptions to use a
light **at night** and to possess a loaded firearm **at night**. That is what
sent me to the definition of "night", which is where the window lives.

**And the corpus was three instruments of forty-plus.** C-61.1 carries well over
forty regulations. The three I searched were the three with hunting in the title.
That was reasonable and it was not a census.

---

## The provisions, and what each one is and is not

### 1. The window — Act s. 1 + r. 12 s. 21

Above. **IS** the general legal hunting window, by definition plus prohibition.
**IS NOT** stated as an hours rule anywhere, so a search for one returns nothing.

### 2. Wild turkey — r. 12, s. 14 (referring to Schedule III ss. 16, 16.1)

> During a wild turkey hunting season in sections 16 and 16.1 of Schedule III,
> hunting is permitted only in the morning from one half hour before sunrise
> until noon.

**IS** a species-specific narrowing, and the third jurisdiction found to close
turkey early (Ontario 7 p.m., Québec noon). **IS NOT** derivable from the general
window — computing sunset for a turkey hunt overshoots by hours.

This is already carried in `ca-qc-2026.json` as `legalTime`, from quebec.ca. The
regulation says the same thing, so the ministry's summary and the law agree here.

### 3. The night definition that is NOT the window — Act s. 30.1, third paragraph

> **For the purposes of the presumption provided in the second paragraph**,
> night is the period extending from one hour and a half after sunset to one
> hour and a half before sunrise.

**IS** an evidentiary definition serving the presumption in s. 30.1 ¶2 (a person
in possession of a spotlight and a weapon in a place frequented by big game is
presumed to be hunting). **IS NOT** the hunting window, and it is a *different
duration* — one and a half hours, against the Act's general half hour.

**The scoping words are the deciding fact.** Read without them, this provision
appears to define night as 1.5 hours either side and would widen every Québec
hunting window by an hour at each end. That is the trap, and it is the reason
this paragraph must never be read on its own.

### 4. The prohibition whose exception is inside the sentence — Act s. 30.3

> No person may, without a reasonable excuse, be in possession of a loaded
> firearm or an armed crossbow at night in a place frequented by wildlife,
> **unless he carries on an authorized hunting activity** or is authorized by
> law to be in possession of a firearm by reason of his office or duties.

**IS** a possession prohibition. **IS NOT** an hours rule, and it does not
prohibit the lawful night hunts of s. 21 — the exception is in the same
sentence. Dropping the clause makes a lawful night hare hunt read as illegal:
§8's stricter-than-the-source failure, with a hunter on the wrong side of it.

### 5. Night hunting exemptions — r. 18.1

A holder of a blood-tracking dog handler's certificate may use a light at night
to locate big game, and may possess a loaded firearm at night. Conditions attach
(including reflective bands on the required orange).

**IS** confirmation of the structure: Québec regulates hunting time through
prohibitions on night activity plus named exemptions, never through a stated
window. **IS NOT** relevant to an ordinary hunt's legal hours.

---

## What this means for the hours model

- Québec's general window is the same **±30 minutes** shape already encoded for
  Ontario, Alberta and Manitoba. The existing `SUNRISE_SUNSET_OFFSET` basis
  expresses it; no new basis is needed for the general case.
- **The citation is not a single section.** The fact is the Act's definition
  plus the regulation's restriction. Whatever carries provenance should be able
  to cite two instruments for one window, or the answer will cite something that
  does not say what the answer says.
- **Turkey needs `SUNRISE_OFFSET_TO_FIXED_CLOSE`**, which already exists — built
  for Ontario's 7 p.m. and Québec's noon.
- **The enumerated night hunts are a real exception set**, not a footnote. Hare
  and rabbit by snare, three frog species, and raccoon with a hound may be
  hunted at night. **Arctic hare and snowshoe hare are served species**, so this
  is live rather than theoretical: a snare hunt for hare is not confined to the
  general window, while a firearm hunt for the same animal is. The distinction is
  the METHOD, not the species.
- Nothing here has been checked against the remaining C-61.1 regulations
  (below), so a site-specific narrowing may exist that this does not cover.

---

## Scope, stated so the next reader inherits it rather than re-deriving it

**Searched:** the Act; r. 12; r. 1; r. 18.1 — in French and official English.

**Not searched:** the other C-61.1 regulations, of which there are more than
forty. Those most likely to narrow hunting time for a particular place are the
reserve and sanctuary regulations (r. 26, r. 27, r. 29, r. 30, r. 31), the
prohibition-of-hunting-on-certain-territories regulation (r. 25), and the
wildlife habitats regulation (r. 18). **A site-specific hours rule in one of
those would not contradict this finding, but it would qualify it.**

**Also not searched:** the Schedules of r. 12, which are published as separate
PDFs rather than in the document body. The turkey window is stated in the body
(s. 14) while its seasons live in Schedule III, so the body does appear to carry
the operative time rules — but that is an observation, not a census.

**On quotation.** The Québec freeze on new verbatim legislative text is live.
Every quotation here is one where §8's exception applies in terms — the deciding
scoping words of s. 30.1 ¶3, the in-sentence exception of s. 30.3, a stated
window, and a definition whose exact duration IS the fact. Nothing is quoted for
colour, and no provision is reproduced in full.
