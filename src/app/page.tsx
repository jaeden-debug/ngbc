import type { Metadata } from "next";
import HomeDiscovery from "../components/HomeDiscovery";
import HomePageClient from "../components/HomePageClient";

export const metadata: Metadata = {
  title: {
    absolute: "North Ground Bushcraft | Canadian Outdoor Knowledge & Tools",
  },
  description: "Practical Canadian outdoor knowledge, field-tested guides and useful tools for hunting, bushcraft, camping, cold weather and exploring the outdoors.",
  alternates: {
    canonical: "/",
  },
};

export default function Page() {
  return (
    <HomePageClient>
      <HomeDiscovery />
    </HomePageClient>
  );
}
