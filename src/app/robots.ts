import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      /* Species photos are public, EXIF-stripped renditions of active assets and
         are the image of every species page. The zone geometry is what Hunt's
         opening map draws: a renderer that obeys robots.txt and is refused it
         renders every authority's zones as "not answering" (reproduced
         2026-10-29 — 14 false outage notices on production /hunt). The rest of
         /api/ is not content. */
      allow: ["/", "/api/species-media/", "/api/hunt/zones"],
      disallow: "/api/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL.origin,
  };
}
