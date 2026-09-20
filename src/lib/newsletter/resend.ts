const RESEND_API_URL = "https://api.resend.com";

export class NewsletterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterConfigurationError";
  }
}

export class NewsletterProviderError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string) {
    super(`Newsletter provider request failed (${status}, ${code})`);
    this.name = "NewsletterProviderError";
    this.status = status;
    this.code = code;
    this.retryable = status === 409 || status === 429 || status >= 500;
  }
}

interface ResendConfig {
  apiKey: string;
  segmentId: string;
}

type NewsletterEnvironment = Readonly<Record<string, string | undefined>>;

interface ResendContact {
  id: string;
  email?: string;
  unsubscribed?: boolean;
}

interface ProviderResponse {
  ok: boolean;
  status: number;
  json: unknown;
}

export interface NewsletterSubscriptionResult {
  provider: "resend";
  contactId: string;
  created: boolean;
}

function getConfig(environment: NewsletterEnvironment): ResendConfig {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const segmentId = environment.RESEND_SEGMENT_ID?.trim();

  if (!apiKey || !segmentId) {
    throw new NewsletterConfigurationError(
      "RESEND_API_KEY and RESEND_SEGMENT_ID are required for newsletter subscriptions",
    );
  }

  return { apiKey, segmentId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseContact(value: unknown): ResendContact | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : undefined,
    unsubscribed: typeof value.unsubscribed === "boolean" ? value.unsubscribed : undefined,
  };
}

function providerCode(value: unknown): string {
  if (!isRecord(value)) return "unknown_error";
  return typeof value.name === "string"
    ? value.name
    : typeof value.type === "string"
      ? value.type
      : "unknown_error";
}

async function providerRequest(
  path: string,
  init: RequestInit,
  config: ResendConfig,
  fetchImplementation: typeof fetch,
): Promise<ProviderResponse> {
  let response: Response;

  try {
    response = await fetchImplementation(`${RESEND_API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new NewsletterProviderError(503, "network_error");
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // Resend may return an empty body for some successful membership writes.
  }

  return { ok: response.ok, status: response.status, json };
}

async function getContact(
  email: string,
  config: ResendConfig,
  fetchImplementation: typeof fetch,
): Promise<ResendContact | null> {
  const result = await providerRequest(
    `/contacts/${encodeURIComponent(email)}`,
    { method: "GET" },
    config,
    fetchImplementation,
  );

  if (result.status === 404) return null;
  if (!result.ok) throw new NewsletterProviderError(result.status, providerCode(result.json));

  const contact = parseContact(result.json);
  if (!contact) throw new NewsletterProviderError(502, "invalid_provider_response");
  return contact;
}

async function ensureSubscribedContact(
  email: string,
  contact: ResendContact,
  config: ResendConfig,
  fetchImplementation: typeof fetch,
): Promise<NewsletterSubscriptionResult> {
  const updated = await providerRequest(
    `/contacts/${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ unsubscribed: false }),
    },
    config,
    fetchImplementation,
  );

  if (!updated.ok) {
    throw new NewsletterProviderError(updated.status, providerCode(updated.json));
  }

  const membership = await providerRequest(
    `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(config.segmentId)}`,
    { method: "POST" },
    config,
    fetchImplementation,
  );

  if (!membership.ok) {
    throw new NewsletterProviderError(membership.status, providerCode(membership.json));
  }

  const updatedContact = parseContact(updated.json);
  return {
    provider: "resend",
    contactId: updatedContact?.id ?? contact.id,
    created: false,
  };
}

export async function subscribeWithResend(
  email: string,
  options: {
    environment?: NewsletterEnvironment;
    fetchImplementation?: typeof fetch;
  } = {},
): Promise<NewsletterSubscriptionResult> {
  const environment = options.environment ?? process.env;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const config = getConfig(environment);

  const existing = await getContact(email, config, fetchImplementation);
  if (existing) {
    return ensureSubscribedContact(email, existing, config, fetchImplementation);
  }

  const created = await providerRequest(
    "/contacts",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: [{ id: config.segmentId }],
      }),
    },
    config,
    fetchImplementation,
  );

  if (created.ok) {
    const contact = parseContact(created.json);
    if (!contact) throw new NewsletterProviderError(502, "invalid_provider_response");
    return { provider: "resend", contactId: contact.id, created: true };
  }

  // Two identical requests can both observe a missing contact. Re-read once
  // before failing so the losing create remains duplicate-safe.
  const racedContact = await getContact(email, config, fetchImplementation);
  if (racedContact) {
    return ensureSubscribedContact(email, racedContact, config, fetchImplementation);
  }

  throw new NewsletterProviderError(created.status, providerCode(created.json));
}
