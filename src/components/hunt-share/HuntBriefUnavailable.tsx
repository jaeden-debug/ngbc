import Image from "next/image";
import Link from "next/link";
import styles from "./HuntBrief.module.css";

/**
 * Why a Hunt Brief cannot be shown.
 *
 * Each reason says something different and is kept distinct, because the
 * reader acts on it differently: a brief that does not exist is gone, one that
 * storage cannot reach may be back in a minute, and one in an older format is
 * there but cannot be displayed safely.
 */
export type HuntBriefUnavailableReason = "not_found" | "storage_unavailable" | "unsupported_version";

const COPY: Record<HuntBriefUnavailableReason, { heading: string; body: string }> = {
  not_found: {
    heading: "This Hunt Brief isn’t available",
    body:
      "The link may be mistyped, or the brief may no longer exist. A Hunt Brief is a snapshot " +
      "of one day’s answer — check the current rules for the area instead.",
  },
  storage_unavailable: {
    heading: "Hunt Brief unavailable",
    body: "Hunt Brief storage is temporarily unavailable. Try this link again later.",
  },
  unsupported_version: {
    heading: "Hunt Brief unavailable",
    body: "This link uses a Hunt Brief format that this version of North Ground cannot safely display.",
  },
};

/**
 * Server-rendered in full. Whoever reaches this followed a link someone sent
 * them, often outdoors and on poor signal, so it must say what happened and
 * offer the way forward before any JavaScript arrives.
 */
export default function HuntBriefUnavailable({ reason }: { reason: HuntBriefUnavailableReason }) {
  const { heading, body } = COPY[reason];
  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.unavailable}`}>
        <p className={styles.brand}>
          <Image src="/logo-mark.webp" alt="" width={820} height={862} sizes="26px" />
          North Ground Hunt
        </p>
        <h1>{heading}</h1>
        <p>{body}</p>
        <Link className={styles.action} href="/hunt">Check current Hunt</Link>
      </div>
    </main>
  );
}
