import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HuntBriefCard from "../../../../components/hunt-share/HuntBriefCard.tsx";
import {
  buildHuntBriefMetadata,
  unavailableHuntBriefMetadata,
} from "../../../../lib/hunt-share/metadata.ts";
import { loadHuntBrief } from "./data.ts";
import styles from "../../../../components/hunt-share/HuntBrief.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shareId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const result = await loadHuntBrief(shareId);
  if (result.status !== "found") {
    return unavailableHuntBriefMetadata();
  }
  return buildHuntBriefMetadata(result.brief);
}

export default async function HuntBriefPage({ params }: Props) {
  const { shareId } = await params;
  const result = await loadHuntBrief(shareId);

  if (result.status === "missing" || result.status === "invalid_id" || result.status === "invalid") {
    notFound();
  }

  if (result.status === "unavailable" || result.status === "unsupported_version") {
    return (
      <main className={styles.page}>
        <div className={`${styles.shell} ${styles.unavailable}`}>
          <p className={styles.brand}>North Ground Hunt</p>
          <h1>Hunt Brief unavailable</h1>
          <p>
            {result.status === "unsupported_version"
              ? "This link uses a Hunt Brief format that this version of North Ground cannot safely display."
              : "Hunt Brief storage is temporarily unavailable. Try this link again later."}
          </p>
          <Link className={styles.action} href="/tools/season-finder">Check current Hunt</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">North Ground Hunt</Link>
        <HuntBriefCard brief={result.brief} />
      </div>
    </main>
  );
}
