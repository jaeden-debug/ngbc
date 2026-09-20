# Content Quality and Publication Gate

North Ground's rule is: answer the intent immediately, include every fact that materially helps the decision, and remove every sentence that does not. There is no target word count.

## Reject conditions

A resource is not publishable when it contains generic introductions, filler, fake storytelling, SEO padding, repeated conclusions, AI clichés, empty listicles, thin location swaps, unsupported material claims, fake expertise, fake field testing, or placeholder copy represented as finished content.

The following are hard failures:

- title/URL promises a question the visible answer does not resolve;
- regulatory or safety claim lacks appropriate provenance;
- missing data is described as absence of a rule or hazard;
- `fieldTested: true` has no valid North Ground field-test relationship/evidence;
- species media identity is uncertain but presented as that species;
- a published record points to missing/retired entities or broken canonical URLs;
- generated or translated legal terminology is presented as official;
- a quick answer contradicts the body or cited source;
- the page is a duplicate/near-duplicate with only a place/species token changed.

## Required publication checks

### Intent and decision

- The primary intent is answered in the first useful screen/section.
- The quick answer stands alone and states material qualifiers.
- Important follow-up questions and exceptions are covered.
- The user has a useful next action when one exists.
- The best surface owns the intent (tool, entity, guide, field test, or jurisdiction page).

### Accuracy and trust

- Factual claims are separated from advice, observation, and legal results.
- High-impact claims map to appropriate sources.
- Units, dates, geography, and effective periods are explicit.
- Uncertainty, conflicts, and limitations are visible.
- Regulatory facts use authoritative provenance and do not outlive their review policy.
- Scientific names, species identity, and similar-species warnings have been checked.
- First-party claims identify the field test and its limitations.

### Structure and reuse

- Canonical entity IDs exist and resolve.
- Reusable facts live in their best canonical home.
- App-worthy advice is in stable blocks instead of copied across components.
- Relationships are typed, justified, and valid.
- Related links are bounded and help the next decision.

### Search and accessibility

- Title, description, H1, canonical URL, intent, and indexing choice are complete.
- Quick answer and essential facts exist in visible server-renderable HTML.
- Heading order is coherent; lists/tables use semantic markup.
- Link names, media alternatives, captions, and language are meaningful.
- Structured data reflects visible content and valid vocabulary.
- No keyword or traffic metric is claimed without recorded evidence quality.

### Lifecycle

- Author/reviewer accountability is recorded where applicable.
- `lastReviewed`, update date, and next review/expiry policy are appropriate.
- Source retrieval/effective dates are present where relevant.
- Draft placeholders, TODOs, and temporary URLs are absent.

## Claim/source policy

| Claim | Minimum acceptable source |
| --- | --- |
| Regulation, season, licence, limit, legal method | Current authoritative source with jurisdiction/effective context |
| Safety/medical threshold | Recognized authority or strong scientific source |
| Species taxonomy/distribution | Recognized taxonomic/scientific authority |
| Product specification | Manufacturer source, clearly identified as specification |
| Product performance | Documented North Ground field test or reputable independent evidence |
| First-party observation | North Ground field-test/evidence record with context and limitations |
| General technique/advice | Editorial review; sources when the claim is factual, disputed, or high-impact |

Source presence alone is insufficient. Reviewers confirm the source actually supports the mapped claim and does not fall outside its date, geography, population, or method.

## Verification and review roles

- Author prepares content and claim mappings.
- Subject reviewer checks completeness and practical accuracy.
- Regulatory reviewer is required for interpreted regulatory claims.
- Copy/SEO review may improve clarity but cannot weaken qualifiers or source language.
- The publisher records the approved revision.

One person may hold multiple roles for low-risk content, but high-impact legal/safety surfaces SHOULD receive independent review.

## Automated validation

The normalized bundle validator checks:

- duplicate IDs and canonical slugs/URLs;
- invalid ID/slug/status values;
- missing quick answers on published guide/condition/reference resources;
- unresolved entity, source, owner, and relationship references;
- orphan published resources;
- missing sources for verified claims;
- field-tested claims without field-test relationships;
- species-targeted media without verified identity;
- invalid validity intervals and unsafe legal-note provenance;
- duplicate relationships and conflicting canonical parents.

Initial rollout is warning-only because current content has not been migrated. A rule becomes CI-blocking after: the adapter exports all in-scope published records, existing warnings are triaged to zero or documented exemptions, an owner is assigned, and the rule passes on two consecutive releases. Errors for malformed bundles and duplicate canonical IDs can block immediately once the exporter exists.

Automation does not decide factual correctness, usefulness, or prose quality.

## Practical sign-off

The reviewer answers yes to all:

1. Can the user act correctly after reading the quick answer?
2. Are material exceptions and unknowns visible?
3. Can every high-impact claim be traced to evidence?
4. Is anything presented as tested that was not tested?
5. Do every entity, relationship, link, and media record resolve?
6. Does every paragraph earn its place?
7. Is there a clear next action without manipulative linking?
8. Will the page remain honest if a source or condition changes?

If any answer is no, return the resource to review.
