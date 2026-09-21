import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import HuntBriefCard from "../../../../components/hunt-share/HuntBriefCard.tsx";
import HuntBriefUnavailable from "../../../../components/hunt-share/HuntBriefUnavailable.tsx";
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

  // Normally unreachable for "missing" and "invalid_id": the proxy answers those
  // with a fully server-rendered 404 before this page runs (see
  // lib/hunt-share/route.ts). Kept for requests that bypass it, and for
  // "invalid" — a stored brief that fails validation — which the proxy cannot
  // see without fetching the whole snapshot.
  if (result.status === "missing" || result.status === "invalid_id" || result.status === "invalid") {
    notFound();
  }

  if (result.status === "unavailable" || result.status === "unsupported_version") {
    return (
      <HuntBriefUnavailable
        reason={result.status === "unsupported_version" ? "unsupported_version" : "storage_unavailable"}
      />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">
          <Image src="/logo-mark.webp" alt="" width={820} height={862} sizes="26px" />
          North Ground Hunt
        </Link>
        <HuntBriefCard brief={result.brief} />
      </div>
    </main>
  );
}
