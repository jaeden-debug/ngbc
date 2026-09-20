# North Ground Hunt Brief sharing

## Architecture

Hunt Brief sharing is a versioned, privacy-safe snapshot projection of the existing `HuntEvaluation`. It does not evaluate legality and it does not import regulatory rules. The adapter in `src/lib/hunt-share/from-hunt-evaluation.ts` copies the existing result states exactly, resolves no missing facts, and deliberately excludes coordinates and display geometry.

The flow is:

1. Hunt produces a `HuntEvaluation`.
2. `huntEvaluationToShareInput()` projects it with an explicitly supplied jurisdiction and optional approved coarse location label.
3. `ShareHuntButton` previews the shared fields and explains the privacy boundary.
4. `POST /api/hunt/share` validates and rate-limits the bounded payload.
5. The server assigns a 144-bit opaque ID, creates a version-1 snapshot, and writes it once to the private `hunt_brief` table in Supabase.
6. `/hunt/share/[shareId]` reads and validates the snapshot server-side, then renders a noindex read-only page and dynamic social image.

The stored record is intentionally compact. It references canonical species, jurisdiction, management-zone, source and resource IDs while retaining enough rendered snapshot text to show exactly what North Ground reported at creation time.

## Privacy model

Exact latitude/longitude, map geometry, raw location input, postal codes, addresses, account IDs, session IDs and arbitrary private context are not fields in `ShareHuntBriefV1`.

Privacy is enforced twice:

- `createHuntBriefRequestPayload()` creates a client request from an explicit allowlist before transmission.
- `createShareableHuntBrief()` creates the persisted snapshot from another explicit allowlist on the server.

A general location label is excluded unless the integration explicitly sets `shareApproved: true`. The default integration below shares only Ontario and the resolved WMU.

## Snapshot and staleness semantics

The brief is what North Ground reported at `createdAt`; it is not automatically rewritten when regulations or forecasts change. The page displays the generation timestamp, regulatory verification timestamp when available, and a standing warning to check current rules and official sources.

No current-status comparison is claimed. “Check current Hunt” links to `/hunt` with non-sensitive species, jurisdiction, zone and date query parameters. The existing Hunt page may consume those parameters when its owner adds preselection.

Weather is explicitly labeled as the forecast captured when the brief was created. An unavailable or failed provider state remains unavailable; sharing never invents weather.

## Retention

Version-1 briefs do not expire automatically. Hunt plans can remain useful, and removing an old URL would not solve regulatory staleness. Staleness is handled through timestamps and the current-check action. A future retention policy can add `expiresAt` in a new schema version without changing old snapshots.

## Persistence and environment

Snapshots are rows in the private `hunt_brief` table in Supabase, written with the service-role key from the server only. Upstash Redis was the earlier choice and has been removed: it is not a dependency, not configured, and not to be reintroduced. `HuntBriefStore` still isolates the storage boundary, so the projection and the page do not know which database is behind it.

Required production variables:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
HUNT_SHARE_RATE_LIMIT_SECRET=...
```

The service-role key is server-only and must never reach the browser. Missing configuration fails closed with `503`. Row keys are the opaque share ID. Rate limiting runs in the database through `consume_hunt_share_rate_limit`, which stores only an HMAC of the client network identifier; raw IP addresses are never written or logged by application code.

## Security boundaries

- 144-bit random URL-safe share IDs are non-enumerable.
- Creation accepts only same-origin JSON up to 32 KiB.
- Distributed rate limiting defaults to eight creation attempts per ten minutes per HMACed client network identifier.
- Persisted values are schema-validated on write and read.
- Text is bounded, normalized, and rejects markup/control characters.
- Source URLs must be HTTPS; resource links must be internal paths or HTTPS.
- The endpoint cannot store HTML or arbitrary JSON fields.
- Unsupported future/legacy versions fail with a safe explanatory state.
- Share pages are `noindex, follow, noarchive` and are never added to the sitemap.

## Metadata and rendering

The server-rendered page includes the species, date, jurisdiction, management zone, exact regulatory status, summary, verified legal-time rule where present, weather snapshot state, warnings, source references and verification timestamps. It remains useful without JavaScript.

Dynamic metadata and the 1200×630 typographic Open Graph image include only species, zone/jurisdiction, date, status and North Ground identity. They never include coordinates or the optional general location label.

## Hunt integration surface

`src/app/tools/season-finder/HuntClient.tsx` now renders the share control beside an evaluated regulatory result. The integration remains deliberately small and client-side:

```tsx
import ShareHuntButton from "../../../components/hunt-share/ShareHuntButton";
import { huntEvaluationToShareInput } from "../../../lib/hunt-share/from-hunt-evaluation";

// Render beside the existing result actions, only when `result` exists:
<ShareHuntButton
  huntResult={huntEvaluationToShareInput(result, {
    jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
  })}
/>
```

Do not pass `result.input.latitude`, `result.input.longitude`, or a raw address as a general label. If Hunt later derives a genuinely coarse, user-understood label, pass it only as:

```tsx
generalLocation: { label: coarseLabel, shareApproved: true }
```

The current-check URL already carries the safe canonical IDs/date. Hunt does not yet read those query parameters to prefill the form; the share page remains useful without that optional enhancement.

## Known limitations

- Live persistence and end-to-end recipient-link verification require the three production environment variables above.
- No “rules unchanged” comparison is shown because the current engine has no safe snapshot-diff contract.
- No analytics events were added because the repository has no analytics abstraction/provider.
- No deletion UI exists under the indefinite-retention policy.
- STALKR is not integrated.
