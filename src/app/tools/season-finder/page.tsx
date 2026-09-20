import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, SITE_NAME } from "../../../lib/site";
import HuntClient from "./HuntClient";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const canonicalPath = "/tools/season-finder";
const metaTitle = "Hunting Zone & Season Finder | North Ground Hunt";
const metaDescription = "Find your hunting zone, check current seasons and rules, view official sources, weather and local hunt information, and share your Hunt Brief.";
const socialTitle = "North Ground Hunt | Your Zone. Your Season. Your Hunt.";
const socialDescription = "Find hunting zones, check current seasons and rules, verify official sources, and share your Hunt Brief with friends.";
const socialImage = absoluteUrl("/north-ground-hunt-zones-seasons-share-results.jpg");
const socialImageAlt = "North Ground Hunt social preview showing hunting zones, current seasons, official sources and Hunt Brief sharing.";

export const metadata: Metadata = {
  title: { absolute: metaTitle },
  description: metaDescription,
  alternates: { canonical: canonicalPath },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: absoluteUrl(canonicalPath),
    siteName: SITE_NAME,
    title: socialTitle,
    description: socialDescription,
    images: [{ url: socialImage, width: 1536, height: 803, alt: socialImageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: socialDescription,
    images: [{ url: socialImage, alt: socialImageAlt }],
  },
};

export default function HuntPage() {
  const defaultDate = new Date().toISOString().slice(0, 10);
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar} aria-label="Primary">
          <Link className={styles.brand} href="/">North Ground</Link>
          <Link className={styles.speciesLink} href="/hunting/species/ruffed-grouse">Ruffed grouse reference</Link>
        </nav>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>North Ground Hunt · certification slice</p>
          <h1>What applies here, on this date?</h1>
          <p className={styles.lede}>Enter an Ontario point and date. North Ground resolves the official WMU, evaluates only the certified rule it actually has, keeps weather separate, and retrieves species knowledge by canonical ID.</p>
          <p className={styles.scope}>Current certified scope: ruffed grouse · Ontario WMU 57 · 2026 source period</p>
        </header>
        <HuntClient defaultDate={defaultDate} />
      </div>
    </main>
  );
}
