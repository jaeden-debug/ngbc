import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      /* Species photos are public, EXIF-stripped renditions of active assets and
         are the image of every species page; the rest of /api/ is not content. */
      allow: ["/", "/api/species-media/"],
      disallow: "/api/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL.origin,
  };
}
