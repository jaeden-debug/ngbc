import type { NextConfig } from "next";
import { redirectPairs } from "./src/lib/content/urls";

/**
 * Google Maps Platform origins.
 *
 * Listed explicitly rather than with a wildcard, and kept in one place so the
 * policy is reviewable. These are present whether or not a Maps key is configured:
 * the allowlist grants nothing by itself, and conditioning CSP on an environment
 * variable would mean the deployed policy differs from the one that was reviewed.
 */
const GOOGLE_MAPS_SCRIPT = "https://maps.googleapis.com";
const GOOGLE_MAPS_CONNECT = "https://maps.googleapis.com https://maps.gstatic.com";
const GOOGLE_MAPS_IMG = "https://maps.googleapis.com https://maps.gstatic.com https://khms0.googleapis.com https://khms1.googleapis.com https://streetviewpixels-pa.googleapis.com";
/* Maps serves its own UI typography: the stylesheet from fonts.googleapis.com,
   the font files from fonts.gstatic.com. Without the stylesheet origin the map
   still works but logs a CSP violation on every load and loses its control
   typography. */
const GOOGLE_FONTS_STYLE = "https://fonts.googleapis.com";
const GOOGLE_FONTS = "https://fonts.gstatic.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src 'self' ${GOOGLE_MAPS_CONNECT}`,
  `font-src 'self' data: ${GOOGLE_FONTS}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: ${GOOGLE_MAPS_IMG}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  // Google Maps compiles helpers into blob workers.
  "worker-src 'self' blob:",
  `script-src 'self' 'unsafe-inline' ${GOOGLE_MAPS_SCRIPT}`,
  `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLE}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  trailingSlash: false,

  /**
   * Canonical route moves come from the route registry, so a path can never be
   * redirected here without the registry agreeing that it moved.
   */
  async redirects() {
    return redirectPairs().map(({ from, to }) => ({
      source: from,
      destination: to,
      permanent: true,
    }));
  },

  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
