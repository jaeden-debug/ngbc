# Newsletter Operations

North Ground newsletter subscriptions persist as Resend Contacts assigned to a dedicated Resend Segment. The application does not store subscriber addresses in logs, source control, local files, or server memory.

## Required setup

1. Create or select the North Ground Resend account. On Vercel, Resend can be installed from the Marketplace; otherwise use the Resend dashboard.
2. Create a **full-access** API key at <https://resend.com/api-keys>. A sending-only key cannot manage Contacts.
3. In Resend Contacts, create a Segment named `North Ground Newsletter` and copy its UUID.
4. Configure these server/deployment variables using `.env.example` as the template:

```text
RESEND_API_KEY=re_...
RESEND_SEGMENT_ID=...
NEXT_PUBLIC_SITE_URL=https://northgroundbushcraft.com
```

Do not expose `RESEND_API_KEY` to browser code. A verified sending domain is not required to persist contacts, but it is required before sending production broadcasts from a North Ground address.

## Request behavior

- Email addresses are Unicode-normalized, trimmed, lowercased, syntax-checked, and limited to 254 characters.
- A new address becomes a global Resend Contact and is assigned to the configured Segment.
- An existing address is updated to subscribed and assigned to the Segment. Repeated submissions converge on the same contact instead of creating duplicates.
- Missing credentials, provider failures, or invalid provider responses return an error. The browser never displays success unless Resend confirmed durable contact state.
- Responses do not reveal whether an address was already registered.
- Logs contain provider status/type only, never email addresses or client IPs.

## Abuse controls

The route enforces same-origin browser requests, JSON content type, a 1 KiB body limit, a honeypot field, and rolling per-address/per-IP rate limits. The in-process limiter is defense in depth; serverless instances do not share it. Before a campaign materially increases traffic, add a distributed rate-limit rule in Vercel Firewall for `POST /api/subscribe` and monitor Resend/provider 429 rates.

## Verification

Automated tests cover normalization, invalid inputs, duplicate-safe provider behavior, credential failure, truthful API status, origin enforcement, body limits, and rate limits. A production smoke test still requires real credentials: submit a controlled address, confirm the contact and Segment membership in Resend, then remove or unsubscribe the test contact.
