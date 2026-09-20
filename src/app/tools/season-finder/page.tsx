import type { Metadata } from "next";
import Link from "next/link";
import HuntClient from "./HuntClient";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ontario ruffed grouse Hunt checker",
  description: "Resolve an official Ontario wildlife management unit and evaluate the certified 2026 ruffed grouse rule with source, boundary and forecast limitations.",
  alternates: { canonical: "/tools/season-finder" },
  openGraph: {
    url: "/tools/season-finder",
    title: "Ontario ruffed grouse Hunt checker",
    description: "Location, date, official WMU source, regulatory result, weather context and North Ground species knowledge in one flow.",
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
