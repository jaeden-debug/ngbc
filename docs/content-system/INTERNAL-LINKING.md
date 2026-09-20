# Internal Linking Standard

Internal links are selected from explicit hierarchy and relationships, not keyword coincidence. The goal is one- or two-click usefulness without turning pages into directories.

## Link classes

| Class | Purpose | Source |
| --- | --- | --- |
| Hierarchical | Up/down navigation within a durable taxonomy | canonical parent and child relationships |
| Contextual | Explain a term or supply needed depth in the current passage | author-selected entity/resource relationship |
| Tool | Move from knowledge to a useful decision interface | explicit tool relationship and applicable context |
| Source | Let users verify a claim | claim/source mapping |
| Related content | Answer the next distinct question | typed relationship plus editorial rationale |

## Page requirements

Every indexable resource page SHOULD provide:

1. a breadcrumb trail from home to its canonical parent;
2. an obvious back/up path that works without browser history;
3. contextual links only where they help understand or act on the current answer;
4. at most one primary tool CTA per decision point;
5. a bounded “next questions” or related section when useful;
6. visible source links near high-impact claims or in a clearly mapped sources section.

Breadcrumbs use the canonical hierarchy only; tags and filters do not enter breadcrumbs. Breadcrumb HTML and structured data must agree.

## Deterministic selection

For a related-content slot:

1. gather active relationships allowed for that slot;
2. exclude self-links, unpublished targets, locale-incompatible targets, and targets already linked in the same slot;
3. require a semantic reason string such as `explains_skill`, `next_decision`, `field_evidence`, or `applicable_tool`;
4. order manual relationships before derived relationships, then explicit weight, freshness where relevant, and canonical ID;
5. apply the slot limit;
6. log unresolved/broken relationships during validation.

No random ordering or “latest post” fallback is used unless recency is the stated user need.

## Limits

Defaults may be overridden by a reviewed page template, but not by individual SEO copy:

- breadcrumbs: one canonical trail, normally 2–5 items;
- inline contextual links: first genuinely useful occurrence per target; normally no more than 5 per 1,000 words;
- tool CTA: 0–2 on a page and never repeated unchanged in adjacent sections;
- next questions: 2–4;
- related resources: 3–6;
- source links: no numeric cap where evidence requires them, but duplicate citations may group claims;
- child index lists: 12 visible initially; use deliberate navigation/pagination for larger collections.

Pages MUST NOT surface every graph edge. If no relationship clears the semantic bar, omit the module.

## Anchor text

- Describe the destination in the sentence's natural language.
- Prefer the entity/resource name or the exact next decision (“check the cold-risk guide”).
- Do not repeat exact-match query phrases unnaturally.
- Avoid “click here,” misleading promises, stacked synonyms, and anchors that imply a legal conclusion.
- When linking an official source, name the authority/document where practical.
- Image-only links require an accessible name.

## Canonical and alias handling

Generated internal links always target the current canonical URL returned by the URL resolver. They never target a legacy alias, tracking URL, raw database path, or query-state URL. A URL change updates the resolver and redirects; authors do not mass-rewrite IDs.

## Page-family guidance

Species pages link to identification/similar species, meaningful guides, field evidence, and jurisdiction resources with documented context. They do not imply local huntability.

Guide pages link to prerequisite skills, material conditions, relevant tools, and evidence. Jurisdiction pages link to authoritative sources and regulatory tools, with coverage/verification states visible. Field tests link to protocol, tested product/entity, conditions, limitations, and related category guidance.

## Anti-spam checks

Validation warns on broken canonical targets, self-links, duplicate target links in a module, missing relationship reasons, over-limit modules, and anchors that are empty or generic. It cannot fully judge usefulness; editorial review remains required.
