-- Conditional regulatory rules.
--
-- The rule table was written for small game, which is answerable from where,
-- when and which species. Major game is not: Ontario publishes deer seasons in
-- separate tables per residency and per implement, and a footnote can exclude
-- rifles from a season the table heading appears to permit them in. Stored in
-- the existing shape, the WMU 71 deer rule — "shotgun only, 2-15 November" —
-- would read as a season open to every hunter with any legal implement.
--
-- Everything here is additive. No existing column changes type or nullability,
-- and every small-game row already published remains valid unchanged.

-- ── What the rule turns on ──────────────────────────────────────────────────
-- The dimensions the authority attached to THIS rule, as canonical values:
-- {"RESIDENCY":"RESIDENT","HUNT_METHOD":["SHOTGUN","MUZZLELOADER","BOW"]}.
-- An empty object means the rule genuinely applies to everyone the species and
-- zone reach, which is the small-game case.
alter table public.regulatory_rules
  add column if not exists applies_when jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'regulatory_rule_applies_when_object'
  ) then
    alter table public.regulatory_rules
      add constraint regulatory_rule_applies_when_object
      check (jsonb_typeof(applies_when) = 'object');
  end if;
end $$;

-- ── A stated closure is not a missing rule ─────────────────────────────────
-- Ontario writes "None" in the non-resident cell for many units. That is the
-- authority declaring there is no season, which is CLOSED — categorically
-- different from a unit no row names, which is UNKNOWN. Flattening the two is
-- how "we could not find a rule" becomes "you may not hunt".
alter table public.regulatory_rules
  add column if not exists declared_no_season boolean not null default false;

-- ── The authority's own season wording ─────────────────────────────────────
-- Kept verbatim so a reviewer compares against the published phrase rather than
-- against a parsed interpretation of it.
alter table public.regulatory_rules
  add column if not exists season_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'regulatory_rule_no_season_has_no_dates'
  ) then
    -- A row that says there is no season must not also carry one.
    alter table public.regulatory_rules
      add constraint regulatory_rule_no_season_has_no_dates
      check (not declared_no_season or (season_opens is null and season_closes is null));
  end if;
end $$;

comment on column public.regulatory_rules.applies_when is
  'Dimensions this rule is conditional on, as canonical values. An empty object means it applies to everyone the species and zone reach. A conditional rule stored with {} would read as unconditional and is the failure this column exists to prevent.';
comment on column public.regulatory_rules.declared_no_season is
  'True when the authority itself states there is no season (Ontario writes "None"). CLOSED because it was said, never because a row was absent.';
comment on column public.regulatory_rules.season_label is
  'The authority''s own season wording, verbatim, for review against the published source.';

-- ── A rule may rest on more than one published page ────────────────────────
-- Deer alone is certified against four pages of the 2026 summary. `source_id`
-- stays as the rule's primary citation; this records the rest, with the section
-- each one contributed, so provenance survives at the rule level.
create table if not exists public.regulatory_rule_sources (
  rule_id uuid not null references public.regulatory_rules(id) on delete cascade,
  source_id uuid not null references public.regulatory_sources(id),
  source_section text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (rule_id, source_id)
);

create index if not exists regulatory_rule_sources_source_idx
  on public.regulatory_rule_sources (source_id);

comment on table public.regulatory_rule_sources is
  'Every published source a rule rests on. The rule''s own source_id remains its primary citation; this table carries the others and the section each contributed.';

-- ── Access ─────────────────────────────────────────────────────────────────
-- Same posture as every other regulatory table: service role only, never the
-- browser. Regulatory writes are a reviewed server operation.
alter table public.regulatory_rule_sources enable row level security;

revoke all on public.regulatory_rule_sources from anon, authenticated;
grant select, insert, delete on public.regulatory_rule_sources to service_role;
