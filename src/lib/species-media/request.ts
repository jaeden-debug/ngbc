export function sameOrigin(request: Request, canonicalOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin || origin === canonicalOrigin;
}
export function canonicalOrigin(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
    || "https://www.northgroundbushcraft.com";
}
