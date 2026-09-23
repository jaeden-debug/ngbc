import type { Metadata } from "next";
import HomeDiscovery from "../components/HomeDiscovery";
import HomePageClient from "../components/HomePageClient";
import { OPEN_GRAPH_BASE } from "../lib/seo/open-graph";

/* Says only what the site holds today: Hunt and the species library. Guides and
   field tests are named when they exist, not before (blueprint §61). */
const HOME_DESCRIPTION =
  "Canadian outdoor knowledge and tools from North Ground. Find your hunting zone and check seasons with North Ground Hunt, and explore North American game species.";
const HOME_SOCIAL_TITLE = "North Ground | Canadian Outdoor Knowledge & Tools";

export const metadata: Metadata = {
  title: {
    absolute: "North Ground Bushcraft | Canadian Outdoor Knowledge & Tools",
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    type: "website",
    url: "/",
    title: HOME_SOCIAL_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_SOCIAL_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default function Page() {
  return (
    <HomePageClient>
      <HomeDiscovery />
    </HomePageClient>
  );
}
