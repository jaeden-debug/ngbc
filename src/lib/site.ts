const DEFAULT_SITE_URL = "https://northgroundbushcraft.com";

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
