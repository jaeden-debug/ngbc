-- Conditional rules that carry their own geography, windows and disputes.
--
-- The rule table stores a season as the authority's phrase and leaves the dates
-- to the bundle. Manitoba's regulation, and every jurisdiction written like it,
-- needs four more facts to be reproduced from the store rather than merely
-- labelled there:
--
--   season_windows  the resolved calendar windows the engine evaluates, one per
--                   stated range, so "Sept. 1 – Jan. 1" is stored as the days it
--                   means within the licence year, not re-parsed by a reader
--   geography       where inside its group the rule reaches: game bird hunting
--                   zones, named places such as CFB Shilo carved out of a season,
--                   or the R.M. of Macdonald part of GHA 38
--   disputes        a place where the regulation and the official summary disagree
--                   about whether the rule reaches it. Where the dispute decides
--                   the answer, Hunt answers CONFLICT; stored without it, the row
--                   would read as settled
--   notes           statements the source attaches to the rule for one area
--
-- A group can also cover only part of an area: "Areas 26 and 36 (excluding
-- Whiteshell Game Bird Refuge)" reaches all of GHA 26 and part of GHA 36.
-- Membership records which.
--
-- Everything here is additive, with defaults that leave every published row
-- exactly as it was.

alter table public.regulatory_group_members
  add column if not exists membership text not null default 'FULL';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'regulatory_group_member_membership') then
    alter table public.regulatory_group_members
      add constraint regulatory_group_member_membership check (membership in ('FULL', 'PARTIAL'));
  end if;
end $$;

alter table public.regulatory_rules
  add column if not exists season_windows jsonb not null default '[]'::jsonb,
  add column if not exists geography jsonb,
  add column if not exists disputes jsonb not null default '[]'::jsonb,
  add column if not exists notes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_season_windows_array') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_season_windows_array check (jsonb_typeof(season_windows) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_geography_object') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_geography_object check (geography is null or jsonb_typeof(geography) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_disputes_array') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_disputes_array check (jsonb_typeof(disputes) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_notes_array') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_notes_array check (jsonb_typeof(notes) = 'array');
  end if;
  -- A stated closure has no season to carry, in either representation.
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_no_season_has_no_windows') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_no_season_has_no_windows
      check (not declared_no_season or season_windows = '[]'::jsonb);
  end if;
end $$;

comment on column public.regulatory_group_members.membership is
  'FULL when the group reaches the whole area; PARTIAL when its official wording excludes part of it (a refuge, a municipality). A PARTIAL member is answered only where the rule''s geography places the point.';
comment on column public.regulatory_rules.season_windows is
  'The calendar windows the rule is open, resolved from the authority''s phrase within its licence year: [{opensIso, closesIso, statedAs, ...}]. Empty for rules that keep dates in the bundle only.';
comment on column public.regulatory_rules.geography is
  'Where inside its group the rule reaches, in the authority''s own terms (zones, named places, exclusions). Null when the group alone decides.';
comment on column public.regulatory_rules.disputes is
  'Places where the controlling regulation and the official summary disagree about whether this rule reaches them. An evaluation the dispute decides answers CONFLICT.';
comment on column public.regulatory_rules.notes is
  'Statements the source attaches to this rule, optionally for one area only.';
