const DEFAULT_SITE_URL = "https://www.northgroundbushcraft.com";

export const SITE_NAME = "North Ground";
export const SITE_ALTERNATE_NAME = "North Ground Bushcraft";
export const SITE_DESCRIPTION =
  "Outdoor fieldwork, practical skills, and honest lessons from northern Canadian conditions.";
export const SITE_LANGUAGE = "en-CA";
export const CONTACT_EMAIL = "contact@northgroundbushcraft.com";

function parseSiteUrl(value: string | undefined): URL {
  const candidate = value?.trim() || DEFAULT_SITE_URL;
  const url = new URL(candidate);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use http or https");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export const SITE_URL = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export function absoluteUrl(pathname = "/"): string {
  return new URL(pathname, SITE_URL).toString();
}

/**
 * The calendar North Ground publishes on.
 *
 * Anything rendered from "now" on both the server and the client has to agree
 * about what day — and therefore what year — it is. A Vercel function runs in
 * UTC and a Canadian reader does not, so for the last hours of 31 December the
 * two disagree about the copyright year.
 */
export const SITE_TIME_ZONE = "America/Toronto";

/** The current year where North Ground publishes, not where the server runs. */
export function siteYear(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE, year: "numeric" }).format(now);
}
