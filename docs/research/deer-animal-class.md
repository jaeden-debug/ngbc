# Antlered and antlerless — the class facts, read from each authority

**Status:** research. Nothing here is encoded. The canonical method/class contract
is being defined in another lane, and §57 wants one home for it; this is the
source reading so that encoding is mechanical when the contract lands, and so
nobody has to re-derive it.
**Read:** 2026-09-30, from each authority's own published wording.

---

## The measured gap

Sex and antler class are encoded for **44 of 251 certified deer rules**, all
Québec. Ontario carries 100 deer rules with `appliesWhen.permittedImplements`
only, Manitoba 64 with method as prose in `equipmentStatedAs`, Alberta 43 with
`appliesWhen` only.

## Ontario — white-tailed deer

The definitions are published in the regulations summary, and they are already
structured facts in everything but form:

- **ANTLERED** — "a deer with at least 1 antler of at least **7.5 centimetres**
  long".
- **ANTLERLESS** — "deer with **no antlers or with both antlers less than 7.5
  centimetres** long, which **generally** include adult female deer and fawns of
  both sexes".

**The word "generally" is the whole of §16's point, in the authority's own
hedge.** Antlerless is not a statement about sex: a buck that has dropped its
antlers, or whose antlers are under the threshold, is antlerless. Encoding
antlerless as female would be wrong in Ontario by Ontario's own wording, and it
is the error that puts a hunter in front of a warden holding a legal animal they
were told was not one.

**The threshold is the fact, and it differs between jurisdictions.** Ontario
measures **7.5 cm**; Québec measures **7 cm**. Same unit, same thing measured —
the length of at least one antler — and different numbers. A structured fact can
carry that; a display string cannot be compared.

**How the class is obtained, which is a separate fact from what the class is:**

- The deer tag included with a deer licence is valid for **1 antlered deer in
  any WMU with an open season**.
- An antlerless deer requires one of: success in the **antlerless deer draw**
  (a tag valid for 1 antlerless deer **in a specific WMU**, or 1 antlered deer
  in any WMU), an **additional deer tag** valid for antlerless deer, or **party
  hunting** with someone holding such a tag.
- Some validations are for **antlered deer only** in named WMUs — 76A, 76B, 76C,
  76D, 76E, 77B, 77C, 78A, 78B, 81A and 81B — to limit antlerless harvest.

So an Ontario deer rule carries at least three separable facts: the class the
authority names, the antler measurement that defines it, and the authorization
that grants it. Collapsing them loses the ability to answer "may I shoot this
animal" and "do I hold what I need".

## Québec — the reference, and what it already has right

`ca-qc-2026` carries `animalClasses: ["ANTLERED"]` with
`classLabel: "Cerf de Virginie avec bois (7 cm ou plus)"` and
`permittedImplements` including CROSSBOW. The class and the implement are both
first-class; only the **7 cm** is prose, inside a French display string.

## What has NOT been read yet

Alberta and Manitoba deer class systems, and the class rules for moose, elk and
bear. Recorded as a gap rather than assumed.

## The trap, named before anyone reaches it

**Do not derive a class from a season label.** A season called "bucks only" is
the authority's shorthand and the provision may be narrower than the shorthand.
Encode from the provision that states the class; where a source states a season
without stating a class, the class is **unresolved**, not inferred. An invented
ANTLERLESS is the failure mode this whole file exists to prevent.
