# Supabase migration history — reconciled 2026-09-21

Project `nxzaatqovhbvziecogan` (PostgreSQL 17.6 + PostGIS). This records how the
repository's migration files and the database's migration ledger
(`supabase_migrations.schema_migrations`) came apart, how they were matched from
evidence, and the rule that keeps them matched.

## What had happened

Several sessions applied migrations through the Supabase MCP `apply_migration`
tool. That tool records the migration under **its own timestamp**, not the
version in the repository file's name. So each file that was applied correctly
got a ledger row whose version matched no file (`20260920000100_hunt_foundation.sql`
was recorded as `20260920143518 hunt_foundation`). Two further changes were made
outside the ledger entirely: the WMU 57 geometry streamed in chunks, and a
rewrite of `resolve_management_zone_v2` later superseded by `zone_boundary_distance`.

Before reconciliation: 14 repository files; 16 ledger rows; one version in
common with no file (`zone_display_level4_rule`) and none of the file versions
present in the ledger.

## How the mapping was proven

Nothing was matched by name alone.

1. **Ledger SQL against file SQL.** The ledger stores the SQL each version ran.
   With comments and whitespace normalised, 11 files were byte-identical to their
   ledger entry's SQL.
2. **Live objects against a replay.** Every repository migration was replayed, in
   order, into an empty `public.ecr.aws/supabase/postgres:17.6.1.113` container
   (the production image and version), and both databases were fingerprinted by the
   same query: tables and RLS flags, columns, constraints, indexes, policies,
   triggers, function bodies and attributes, table grants, function execute grants
   and the PostGIS extension.
3. The differences found, and their resolution:

| Remote version | Ledger name | Effect | Repository file | Outcome |
|---|---|---|---|---|
| 20260920143518 | hunt_foundation | identical SQL | `20260920000100_hunt_foundation.sql` | EQUIVALENT_TO_CANONICAL — renamed |
| 20260920143630 | certified_ontario_wmu57_2026_sources | jurisdiction + sources + a transient chunk-staging table | first half of `20260920000200_certified_ontario_wmu57_2026.sql` | EQUIVALENT_TO_CANONICAL — file split, staging omitted (net-zero) |
| 20260920143824 | certified_ontario_wmu57_2026_rule | WMU 57 rule; drops the staging table. The zone and its geometry arrived in chunks outside the ledger between the two versions | second half of the same file (zone with inline, byte-identical coordinates + rule) | EQUIVALENT_TO_CANONICAL — split |
| 20260920152203 | zone_ingestion_and_groups | identical SQL | `20260921000100_…` | renamed |
| 20260920152337 | zone_ingestion_functions | `compare_zone_run` filtered `z.jurisdiction_id = run.jurisdiction_id`; the file joined `regulatory_jurisdictions` for the same rows | `20260921000200_…` | file aligned to the live body, renamed |
| 20260920152834 | zone_parity_sampling | identical SQL | `20260921000300_…` | renamed |
| 20260921013656 | conditional_regulatory_rules | identical SQL | `20260921000400_…` | renamed |
| 20260921024131 | generalize_zone_promotion | identical SQL | `20260921021845_…` | renamed |
| 20260921024142 | register_alberta_wmu_source | identical SQL | `20260921023000_…` | renamed |
| 20260921024308 | register_manitoba_gha_source | identical SQL | `20260921030000_…` | renamed |
| 20260921024640 | register_quebec_zone_source | identical SQL | `20260921040000_…` | renamed |
| 20260921032536 | chunked_zone_staging | identical SQL | `20260921041000_…` | renamed |
| 20260921033757 | conditional_rule_geography_windows | identical SQL | `20260921050000_…` | renamed |
| 20260921033819 | register_manitoba_regulatory_sources | identical SQL | `20260921050100_…` | renamed |
| 20260921034448 | zone_derivatives | as applied (the first `resolve_management_zone_v2`) | committed by the Québec session under this version | already matched |
| 20260921035259 | zone_display_level4_rule | `build_zone_display` level-4 rule | committed by the Québec session under this version | already matched |
| 20260921085602 | zone_boundary_distance | exact boundary distance; `resolve_management_zone_v2` as live today (supersedes the out-of-ledger rewrite) | committed by the Québec session under this version | already matched |

No outcome was UNKNOWN, and no remote entry was reverted: every ledger row's
effect is present live and is reproduced by a repository file.

## The reconciliation

**The ledger was not modified.** No `migration repair`, no row inserted, deleted
or rewritten. Instead the repository files were renamed (`git mv`, so history
follows them) to the versions the ledger already records, which is also the
order the migrations actually ran in production. The WMU 57 file was split to
match its two ledger entries.

Result, verified on 2026-09-21:

- 17 repository files; 17 ledger rows; identical version sets.
- The 17 files, replayed in version order into an empty Supabase Postgres 17.6,
  produce a schema identical to production's on every compared object: 15 tables
  (with RLS flags), 128 columns, 99 constraints, 36 indexes, 2 triggers, 15 table
  grants, 15 functions (bodies and attributes) and 45 function execute grants.
- Nothing already applied will run again: every file's version is in the ledger.

Schema is reproducible from the repository. **Data is not, by design:** zone
geometry comes from each authority through `scripts/ingest-zone-layer.mjs` and
the `publish_zone_run` promotion, and rules through
`scripts/publish-regulations.mjs`, which verifies its own read-back.

## The rule from now on

A migration is applied so that the ledger row carries **the file's own version**.

- Name a new file with a version later than every existing one.
- Apply it the way `supabase db push` does: its SQL and
  `insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('<file version>', '<name>', array['<the SQL>'])` in one transaction
  (via `execute_sql`), **or** apply it with `apply_migration` and immediately
  rename the file to the version that tool reports.
- Never change a live function or table outside a migration file. The v2
  rewrite that was applied directly had to be proven superseded before this
  reconciliation could close.

To check the two agree at any time:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

against `ls supabase/migrations`.
