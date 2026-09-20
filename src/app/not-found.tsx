import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>404 · Off the marked trail</p>
        <h1 className={styles.heading}>Page not found</h1>
        <p className={styles.copy}>
          This route does not exist, or it has moved. Return to North Ground to find your way back.
        </p>
        <Link className={styles.link} href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
