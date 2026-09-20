# North Ground Route Registry

Status: decided 2026-09-20. Supersedes the candidate route families in [CONTENT-CONTRACT.md](./CONTENT-CONTRACT.md) §URL principles.

Canonical IDs remain the identity. This registry owns the **paths those IDs render at**. Applications MUST resolve links through canonical IDs, never by constructing these strings.

## Decision

Hunting content is namespaced under `/hunting/`. The site covers bushcraft, camping and survival as well; leaving hunting at the site root would force those verticals into inconsistent structures later.

No trailing slashes, matching existing repository convention.

## Route families

| Family | Path | Entity type |
| --- | --- | --- |
| Species | `/hunting/species/{species}` | `species` |
| Species group | `/hunting/species/groups/{group}` | `species_group` |
| Country | `/hunting/{country}` | `country` |
| Jurisdiction | `/hunting/{country}/{jurisdiction}` | `jurisdiction` |
| Species × jurisdiction | `/hunting/{country}/{jurisdiction}/{species}` | composite |
| Management zone | `/hunting/{country}/{jurisdiction}/zones/{zone}` | `management_zone` |
| Hunt type / method | `/hunting/guides/{slug}` | `hunt_type`, `method` |
| Conditions | `/hunting/conditions/{slug}` | `condition`, `temperature_band` |
| Clothing | `/hunting/clothing/{slug}` | `clothing_system` |
| Packs | `/hunting/packs/{slug}` | `pack_template` |
| Skills & safety | `/hunting/skills/{slug}` | `skill`, `safety_topic` |
| Gear category | `/hunting/gear/{category}` | `equipment_category` |
| Gear item | `/hunting/gear/{category}/{item}` | `equipment_item`, `product` |
| Field tests | `/hunting/field-tests/{slug}` | `field_test` |
| Tools | `/tools/{slug}` | `tool` |

`/tools/` stays outside `/hunting/` because a tool may serve several verticals. Hunt owns its own internal routes.

## Rules

- One canonical URL per resource per locale. Aliases redirect (301); they are never duplicate pages.
- `{species}` and `{jurisdiction}` slugs MUST derive from the canonical ID key, so `species:ruffed-grouse` renders at `/hunting/species/ruffed-grouse`.
- A species × jurisdiction page MUST NOT be created until it holds material information beyond the two parents. Absent that, link to the parents. This is the primary defence against thin pages.
- Ambiguous regional aliases (`partridge`, `blue grouse`, `prairie chicken`) MUST resolve to a disambiguation response, never silently to one species. The research registry already records these.
- Regulatory status is never encoded in a path. Seasons change annually; URLs must not.
- 404 for unknown slugs; 410 only for intentionally removed resources with no successor.

## Cross-vertical promotion

Some knowledge is not hunting-specific — cold physiology, navigation, hypothermia. These currently live under `/hunting/` because hunting is the launch vertical.

When camping or survival needs the same fact, **promote rather than duplicate**: move the canonical page to a shared root (`/skills/{slug}`), 301 the old path, and let both verticals link to the single canonical resource. One fact, one home, enforced by redirect rather than by discipline.

Do not pre-create shared roots before a second vertical exists.
