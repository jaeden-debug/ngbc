#!/usr/bin/env bash
#
# Local Supabase/PostGIS certification.
#
# Applies supabase/migrations/* to a throwaway database that reproduces Supabase's
# role model, then asserts the behaviour the Hunt product depends on. This proves the
# migrations work before they are applied to a remote project, and it re-proves them
# whenever the schema changes.
#
# It certifies the SQL. It does not certify a remote Supabase project — that requires
# applying the same migrations there and re-running the same assertions.
#
# Usage:
#   scripts/certify-supabase-local.sh
#   SUPABASE_PROBE_ADMIN_URL=postgresql://user:pass@host:5432/postgres scripts/certify-supabase-local.sh
#
# Default target is the local PostGIS container documented in .env.example.

set -euo pipefail

ADMIN_URL="${SUPABASE_PROBE_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:54329/postgres}"
PROBE_DB="${SUPABASE_PROBE_DB:-ngbc_supabase_probe}"
PROBE_URL="${ADMIN_URL%/*}/${PROBE_DB}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v psql >/dev/null 2>&1; then
  if [ -x /opt/homebrew/opt/libpq/bin/psql ]; then
    PATH="/opt/homebrew/opt/libpq/bin:$PATH"
  else
    echo "psql is required. Install libpq (brew install libpq) or the Postgres client." >&2
    exit 1
  fi
fi

if ! psql "$ADMIN_URL" -q -c 'select 1' >/dev/null 2>&1; then
  cat >&2 <<EOF
Cannot reach a PostgreSQL server at:
  ${ADMIN_URL%%\?*}

Start one with PostGIS:
  docker run -d --name ngbc-hunt-postgis \\
    -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres \\
    -p 54329:5432 postgis/postgis:16-3.4

Or point SUPABASE_PROBE_ADMIN_URL at your own PostGIS server.
EOF
  exit 1
fi

failures=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; failures=$((failures + 1)); }

# assert <description> <sql returning a single value> <expected value>
assert() {
  local description="$1" sql="$2" expected="$3" actual
  actual="$(psql "$PROBE_URL" -tA -c "$sql" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$actual" = "$expected" ]; then pass "$description"; else
    fail "$description (expected '$expected', got '${actual:-<error>}')"
  fi
}

# assert_raises <description> <sql that must raise an exception>
# Used where refusing the operation IS the correct behaviour.
assert_raises() {
  local description="$1" sql="$2"
  if psql "$PROBE_URL" -tA -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
    fail "$description (statement succeeded but should have raised)"
  else
    pass "$description"
  fi
}

echo "▸ Preparing throwaway database ${PROBE_DB}"
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${PROBE_DB};" -c "CREATE DATABASE ${PROBE_DB};"

# Supabase provisions these roles; plain PostgreSQL does not.
psql "$PROBE_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin superuser; end if;
end $$;
SQL

echo "▸ Applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if psql "$PROBE_URL" -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null 2>&1; then
    pass "applied $(basename "$migration")"
  else
    fail "applied $(basename "$migration")"
    psql "$PROBE_URL" -v ON_ERROR_STOP=1 -f "$migration" 2>&1 | tail -5 >&2
  fi
done

echo "▸ PostGIS and geometry integrity"
assert "PostGIS is installed in the extensions schema" \
  "select count(*) from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='extensions'" "1"
assert "certified zone geometry is valid" \
  "select extensions.ST_IsValid(geometry) from public.management_zones" "t"
assert "certified zone geometry uses EPSG:4326" \
  "select extensions.ST_SRID(geometry) from public.management_zones" "4326"
assert "certified zone geometry is a MultiPolygon" \
  "select extensions.GeometryType(geometry) from public.management_zones" "MULTIPOLYGON"
assert "management zones carry a GiST spatial index" \
  "select count(*) from pg_indexes where tablename='management_zones' and indexdef ilike '%gist%'" "1"

echo "▸ Spatial resolution"
assert "known interior point resolves exactly one zone" \
  "select count(*) from public.resolve_management_zone(45.23, -77.94)" "1"
assert "known interior point resolves WMU 57" \
  "select canonical_id from public.resolve_management_zone(45.23, -77.94)" "management_zone:ca-on-wmu-57"
assert "zone resolution preserves its official source" \
  "select source_canonical_id from public.resolve_management_zone(45.23, -77.94)" "source:ca-on-wmu-service"
assert "known interior point is not flagged near-boundary" \
  "select near_boundary from public.resolve_management_zone(45.23, -77.94)" "f"
assert "a point outside the certified zone returns no false match" \
  "select count(*) from public.resolve_management_zone(43.65, -79.38)" "0"
assert "an out-of-range latitude resolves nothing" \
  "select count(*) from public.resolve_management_zone(999, -77.94)" "0"
assert "an out-of-range longitude resolves nothing" \
  "select count(*) from public.resolve_management_zone(45.23, -999)" "0"
assert "a point on the mapped boundary is flagged near-boundary" \
  "with edge as (select extensions.ST_PointOnSurface(extensions.ST_Boundary(geometry)) p from public.management_zones limit 1)
   select near_boundary from edge, lateral public.resolve_management_zone(extensions.ST_Y(p), extensions.ST_X(p))" "t"

echo "▸ Share rate limiting"
# Regression: a PL/pgSQL variable named `current_time` is shadowed by the SQL keyword
# CURRENT_TIME (a timetz), which made every call raise a type error.
assert "rate limiter allows a first attempt" \
  "select allowed from public.consume_hunt_share_rate_limit(repeat('a',32), 2, 600)" "t"
assert "rate limiter allows a second attempt" \
  "select allowed from public.consume_hunt_share_rate_limit(repeat('a',32), 2, 600)" "t"
assert "rate limiter denies the attempt beyond the limit" \
  "select allowed from public.consume_hunt_share_rate_limit(repeat('a',32), 2, 600)" "f"
assert_raises "rate limiter rejects a malformed identity hash" \
  "select * from public.consume_hunt_share_rate_limit('short', 2, 600)"
assert_raises "rate limiter rejects a non-positive limit" \
  "select * from public.consume_hunt_share_rate_limit(repeat('b',32), 0, 600)"

echo "▸ Hunt Brief immutability and privacy"
psql "$PROBE_URL" -q -v ON_ERROR_STOP=1 -c \
  "insert into public.hunt_brief_snapshots (public_share_id, schema_version, snapshot, created_at)
   values ('AbCdEfGhIjKlMnOpQrStUv', 1, '{\"shareId\":\"AbCdEfGhIjKlMnOpQrStUv\",\"version\":1}'::jsonb, now());" >/dev/null
assert "a snapshot can be created" \
  "select count(*) from public.hunt_brief_snapshots where public_share_id='AbCdEfGhIjKlMnOpQrStUv'" "1"
assert_raises "a snapshot whose id disagrees with its payload is rejected" \
  "insert into public.hunt_brief_snapshots (public_share_id, schema_version, snapshot, created_at)
   values ('MismatchedIdAbcdefghij', 1, '{\"shareId\":\"SomethingElseEntirely\",\"version\":1}'::jsonb, now())"
assert_raises "a snapshot whose version disagrees with its payload is rejected" \
  "insert into public.hunt_brief_snapshots (public_share_id, schema_version, snapshot, created_at)
   values ('VersionMismatchAbcdefg', 2, '{\"shareId\":\"VersionMismatchAbcdefg\",\"version\":1}'::jsonb, now())"
assert_raises "a duplicate share id is rejected" \
  "insert into public.hunt_brief_snapshots (public_share_id, schema_version, snapshot, created_at)
   values ('AbCdEfGhIjKlMnOpQrStUv', 1, '{\"shareId\":\"AbCdEfGhIjKlMnOpQrStUv\",\"version\":1}'::jsonb, now())"
assert "service_role cannot update a snapshot" \
  "select count(*) from (select 1) t where (select has_table_privilege('service_role','public.hunt_brief_snapshots','UPDATE'))" "0"
assert "service_role cannot delete a snapshot" \
  "select count(*) from (select 1) t where (select has_table_privilege('service_role','public.hunt_brief_snapshots','DELETE'))" "0"
assert "anon cannot read snapshots" \
  "select has_table_privilege('anon','public.hunt_brief_snapshots','SELECT')" "f"
assert "anon cannot read management zones" \
  "select has_table_privilege('anon','public.management_zones','SELECT')" "f"
assert "anon cannot execute the zone resolver" \
  "select has_function_privilege('anon','public.resolve_management_zone(double precision, double precision)','EXECUTE')" "f"
assert "row level security is enabled on every Hunt table" \
  "select count(*) from pg_tables where schemaname='public'
     and tablename in ('hunt_brief_snapshots','management_zones','regulatory_rules','regulatory_sources','regulatory_jurisdictions','hunt_share_rate_limits')
     and rowsecurity is false" "0"
assert "no permissive public policy exists" \
  "select count(*) from pg_policies where schemaname='public'" "0"

echo "▸ Certified regulatory scope"
assert "exactly one management zone is certified" \
  "select count(*) from public.management_zones" "1"
assert "exactly one regulatory rule is certified" \
  "select count(*) from public.regulatory_rules" "1"
assert "the certified rule is the Ontario WMU 57 ruffed grouse record" \
  "select canonical_id from public.regulatory_rules" "regulatory_rule:ca-on-wmu-57-ruffed-grouse-2026"
assert "a published rule cannot cite an unverified source" \
  "select count(*) from (
     select 1 from public.regulatory_rules r
     join public.regulatory_sources s on s.id = r.source_id
     where r.review_status in ('VERIFIED','PUBLISHED')
       and (s.review_status not in ('VERIFIED','PUBLISHED') or s.verified_at is null)
   ) t" "0"

echo
if [ "$failures" -eq 0 ]; then
  echo "Supabase/PostGIS local certification passed."
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${PROBE_DB};" >/dev/null 2>&1 || true
  exit 0
fi
echo "Supabase/PostGIS local certification FAILED with ${failures} failing assertion(s)."
echo "The probe database ${PROBE_DB} was left in place for inspection."
exit 1
