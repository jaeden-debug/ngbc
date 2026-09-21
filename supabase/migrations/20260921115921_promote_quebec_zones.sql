-- Québec's 59 hunting zones become VERIFIED: served by the resolver and drawn by
-- zone_display_in_view. Owner-approved on 2026-09-21.
--
-- The geometry was ingested from MRNF's own service and parity-certified against
-- it on 2026-09-21 (source_verified_at is that certification). Nothing else on
-- the rows changes: not geometry, names, sources or dates. No other jurisdiction
-- is touched, and the statement refuses to run unless it promotes exactly 59.
do $$
declare
  promoted integer;
begin
  update public.management_zones z
     set coverage_status = 'VERIFIED'
    from public.regulatory_jurisdictions j
   where j.id = z.jurisdiction_id
     and j.canonical_id = 'jurisdiction:ca-qc'
     and z.coverage_status = 'NEEDS_VERIFICATION'
     and z.source_verified_at is not null;
  get diagnostics promoted = row_count;
  if promoted <> 59 then
    raise exception 'expected to promote 59 Québec zones, promoted %', promoted;
  end if;
end
$$;
