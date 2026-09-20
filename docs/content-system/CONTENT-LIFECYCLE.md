# Content Lifecycle

The lifecycle protects accuracy while allowing the authoring system, site, and applications to evolve independently.

## States

```text
draft -> in_review -> published -> stale -> in_review -> published
   |         |            |          |                    |
   +---------+------------+----------+------------------> archived
```

- `draft`: incomplete and unavailable to public consumers.
- `in_review`: frozen candidate revision under editorial/source review.
- `published`: approved revision available to allowed consumers.
- `stale`: previously published but past review policy or affected by a source change; treatment depends on risk.
- `archived`: unavailable for ordinary retrieval but retained for history/audit.

Sources also support `superseded`; entities support `deprecated`, `merged`, and `retired` as defined in the taxonomy.

## Workflow

1. **Discover:** record the user intent, canonical owner, entities, and source candidates.
2. **Draft:** write the direct answer, material details, exceptions, blocks, claims, and relationships.
3. **Validate:** export to the normalized contract and resolve automated errors/warnings.
4. **Review:** apply subject, regulatory/safety, media, accessibility, and search checks according to risk.
5. **Approve:** record reviewer IDs, source snapshot/retrieval dates, review date, and revision.
6. **Publish:** atomically promote the approved revision; invalidate content and URL caches.
7. **Observe:** monitor broken links, source changes, user corrections, and usage without treating popularity as accuracy.
8. **Re-review:** compare sources and claims, revise, or explicitly confirm the existing revision.
9. **Archive/replace:** preserve redirects, aliases, source history, and replacement relationships.

Draft content MUST NOT leak through APIs or search indexes. Preview access is authenticated and carries `noindex`.

## Revisions and audit

Every material edit creates a revision with:

- stable owner ID and immutable revision ID;
- author/editor and timestamp;
- reason/change summary;
- previous revision reference;
- normalized content hash;
- review/approval record;
- source and relationship changes;
- publication timestamp.

Corrections are revisions, not silent history rewrites. High-impact regulatory/safety corrections record affected surfaces and cache invalidation.

## Review policy

Review frequency is risk-based, not a single global interval:

| Content | Trigger/maximum policy |
| --- | --- |
| Regulatory explanation/legal note | source change, new effective period, or jurisdiction-defined cycle; stale blocks excluded from decision surfaces |
| Safety threshold/medical guidance | authority update or assigned annual review unless owner sets stricter policy |
| Species taxonomy/conservation | source change or scheduled review appropriate to the authority |
| Field test | immutable observations; review only interpretation, product identity, and broken media/source links |
| General skill/guide | material source/practice change or periodic editorial review |
| Search metadata/links | page move, intent change, or broken-link/indexing audit |

The implementation records `reviewDueAt` or a named policy. Passing a review date does not fabricate new facts. High-risk stale material is withheld or clearly labeled according to policy; low-risk material may remain visible with a stale warning while awaiting review.

## Source change handling

Where monitored, a changed URL, content hash, effective date, or supersession event creates a review task. It does not automatically alter published claims or rules. Reviewers compare old and new source versions and record the disposition: no material change, content revision, conflict, or withdrawal.

## Correction and withdrawal

- Provide a correction route and triage factual/safety/legal reports ahead of style feedback.
- Immediately withdraw content likely to cause material legal or safety harm while it is investigated.
- Correct all derived blocks/pages that reuse the same canonical fact.
- Preserve public redirects when a resource has a successor.
- Use 410 only when deliberate removal has no replacement and legal/product policy calls for it.
- A withdrawn source remains in the audit trail and is excluded from current claim support.

## Localization lifecycle

Translations are revisions linked to the same locale-neutral entities. A source-language update marks affected translations `needs_review`; it does not silently publish machine translations. Legal terminology uses official localized terms when available. Locale fallback is explicit to consumers.

## Migration and rollout

Adapters may migrate current content in stages:

1. export draft and published records without changing routes;
2. run validator in warning mode and inventory gaps;
3. fix identity/reference errors first;
4. backfill claims, sources, blocks, and media verification;
5. certify a page family and enable blocking rules for it;
6. move rendering/API reads to the normalized repository;
7. retain reversible redirects and compare rendered output before retiring legacy storage.

No bulk migration may infer legality, field testing, verification, or species identity from prose.

## Ownership

Each published resource and source-monitoring policy has an accountable owner/team. The content platform owns contract/export integrity; editorial owns meaning and completeness; regulatory owners own rules/provenance; application teams own correct consumption and labeling.
