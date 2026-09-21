import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminSignIn from "./AdminSignIn";
import { currentSpeciesMediaAdmin } from "../../../lib/species-media/admin-auth";

export const metadata: Metadata = { title: "Species media administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SpeciesMediaAdminPage() {
  if (await currentSpeciesMediaAdmin()) redirect("/hunting/species");
  return <main className="ng-product-page"><div className="ng-shell"><AdminSignIn /></div></main>;
}
