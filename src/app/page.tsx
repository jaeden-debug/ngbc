import type { Metadata } from "next";
import HomePageClient from "../components/HomePageClient";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const visuallyHidden: React.CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

export default function Page() {
  return (
    <>
      <h1 style={visuallyHidden}>North Ground — northern fieldwork and practical skills</h1>
      <HomePageClient />
    </>
  );
}
