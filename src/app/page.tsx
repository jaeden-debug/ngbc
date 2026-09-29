import type { Metadata } from "next";
import HomeDiscovery from "../components/HomeDiscovery";
import HomePageClient from "../components/HomePageClient";
import { OPEN_GRAPH_BASE } from "../lib/seo/open-graph";

/* Says only what the site holds today: one tool (Hunt) and the species library.
   Guides, field tests and further tools are named when they exist (§30, §61). */
const HOME_DESCRIPTION =
  "Canadian outdoor knowledge from North Ground. Find your hunting zone and check seasons with North Ground Hunt, and explore game species across Canada.";
const HOME_SOCIAL_TITLE = "North Ground | Canadian Outdoor Knowledge";

export const metadata: Metadata = {
  title: {
    absolute: "North Ground Bushcraft | Canadian Outdoor Knowledge",
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
