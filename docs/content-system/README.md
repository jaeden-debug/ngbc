# North Ground Content System

Status: shared contract v1, storage adapter pending.

This directory defines the presentation-independent contract joining North Ground editorial resources, applications, and public pages. It does not define hunting regulations, GIS behavior, or a CMS. Those systems may use different storage, but their normalized output must satisfy this contract before integration.

## Contract map

| Document | Owns |
| --- | --- |
| [CONTENT-CONTRACT.md](./CONTENT-CONTRACT.md) | Resource, species, source, search, URL, and API shapes |
| [ENTITY-TAXONOMY.md](./ENTITY-TAXONOMY.md) | Canonical entity classes, IDs, aliases, localization, merges |
| [APP-BLOCKS.md](./APP-BLOCKS.md) | Atomic blocks and deterministic contextual matching |
| [RELATIONSHIPS.md](./RELATIONSHIPS.md) | Typed relationship edges and traversal rules |
| [INTERNAL-LINKING.md](./INTERNAL-LINKING.md) | Deterministic page-link selection and limits |
| [CONTENT-QUALITY.md](./CONTENT-QUALITY.md) | Publication gate, claims, sources, and QA |
| [MEDIA-STANDARD.md](./MEDIA-STANDARD.md) | Licensing, identity accuracy, accessibility, and media records |
| [CONTENT-LIFECYCLE.md](./CONTENT-LIFECYCLE.md) | Draft, review, publication, expiry, correction, and migration |
| [ROUTE-REGISTRY.md](./ROUTE-REGISTRY.md) | Decided canonical route families and path rules |
| [CONTENT-ROADMAP.md](./CONTENT-ROADMAP.md) | What gets written, in what order, and the definition of done |
| [INTEGRATION-HANDOFF.md](./INTEGRATION-HANDOFF.md) | Concrete implementation handoff and open compatibility work |

Runtime-neutral TypeScript contracts live in `src/lib/content-contract/`. The validator at `scripts/validate-content-contract.mjs` checks a normalized JSON bundle without requiring the authoring system to store content as JSON.

## System boundary

```text
authoring/CMS/files
        |
        | adapter (owned by the eventual content implementation)
        v
normalized ContentBundle
        |
        +--> validator
        +--> server-rendered resource pages
        +--> internal content service/API
        +--> Hunt and future tools
```

Regulatory data is deliberately outside this bundle. A `legal_note` block may explain or link to a regulatory result, but it cannot determine OPEN/CLOSED status. Applications must obtain legality from the authoritative regulatory/rules system.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are requirements levels. Examples are illustrative and are not coverage claims. All dates are ISO 8601; timestamps use UTC unless an explicit offset is included.

## Versioning

- Contract version `1.x` permits additive optional fields and new enum members handled as unknown by tolerant consumers.
- A breaking field removal, meaning change, or identity-rule change requires a new major version and migration notes.
- Producers emit `contractVersion`; consumers reject unsupported major versions and log unknown minor fields without dropping the whole record.
- API representations SHOULD expose an `ETag` or equivalent revision token derived from normalized content, not from presentation HTML.
