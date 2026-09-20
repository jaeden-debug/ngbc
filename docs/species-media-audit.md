# Species media audit — Waves 1–2

Reviewed: 2026-09-20

Public species imagery is governed by `MediaRecord.identityVerification`. An image may render only when it is active, identifies exactly one canonical species, and is `verified` with provenance. Unsplash API use additionally requires the API-returned hotlinked URL, photographer and Unsplash attribution links, retained URL parameters, and download tracking where applicable. North Ground has not configured an Unsplash API client or a human wildlife-photo review queue, so no search result was promoted.

| Species | Public image | Unsplash photo / photographer | Verification basis | Lookalikes or variation checked | Attribution |
|---|---|---|---|---|---|
| Ruffed grouse | No photo | — | No candidate passed exact-species review | Spruce grouse; sex and plumage variation | Not applicable |
| Spruce grouse | No photo | — | No candidate passed exact-species review | Ruffed grouse; male/female and regional forms | Not applicable |
| Sharp-tailed grouse | No photo | — | No candidate passed exact-species review | Other prairie grouse; northern colour variation | Not applicable |
| Wild turkey | No photo | — | No candidate passed exact-species review | Sex, age and regional tail-tip variation | Not applicable |
| White-tailed deer | No photo | — | No candidate passed exact-species review | Mule deer; sex, age and antler season | Not applicable |
| Moose | No photo | — | No candidate passed exact-species review | Cow, calf and antlerless bull | Not applicable |
| American black bear | No photo | — | No candidate passed exact-species review | Grizzly where ranges overlap; coat colour variation | Not applicable |
| Snowshoe hare | No photo | — | No candidate passed exact-species review | Arctic hare, cottontails; seasonal coat transition | Not applicable |
| Mallard | No photo | — | No candidate passed exact-species review | American black duck, hybrids, female/juvenile/eclipse plumage | Not applicable |
| Canada goose | No photo | — | No candidate passed exact-species review | Cackling goose; population size variation | Not applicable |

This is a publication audit, not evidence that Unsplash lacks suitable photographs. Human visual verification remains mandatory; automated validation can verify provenance and workflow state, not biological identity.

## Wave 2 publication decision

All 50 Wave 2 profiles are intentionally published without a photograph. No Unsplash candidate was promoted because an API-backed attribution record and human exact-species review were not available. This is especially important for the new high-risk lookalikes: gray/eastern wolf/coyote, red/gray/arctic fox, Canada lynx/bobcat, willow/rock ptarmigan, female Mallard/American black duck, greater/lesser scaup, Canada/cackling goose, redhead/canvasback, and white-tailed/mule deer.

The content contract now supports multiple verified images per species with explicit roles: general, adult male, adult female, juvenile, winter form, breeding plumage, nonbreeding plumage, and lookalike comparison. Sex, age, or seasonal labels are optional and must describe only what was independently verified; a general species image cannot inherit a sex label by assumption.

Publication validation rejects species-targeted media unless it identifies exactly one canonical species and has verified identity. Active Unsplash records still require creator, licence, source URL, attribution, alt text, and recorded human verification. Until those conditions are met, the correct production state is “No species photograph published.”
