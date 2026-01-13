import styles from "./page.module.css";
import Hero from "../components/Hero";
import MissionDeck from "../components/MissionDeck";
import NewsletterForm from "../components/NewsletterForm";

export default function Page() {
  return (
    <main className={styles.page}>
      <Hero />
      <MissionDeck />

      <footer id="after-deck" className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <span className={styles.label}>Contact</span>
            <span className={styles.rule} />
          </div>

          <h2 className={styles.h2}>Get updates when we drop new field work</h2>
          <p className={styles.p}>Occasional updates — new uploads, gear we trust, and what we’re testing next.</p>

          <NewsletterForm />

          <div className={styles.footerMeta}>
            <span>© {new Date().getFullYear()} North Ground Bushcraft</span>
            <span className={styles.dot}>•</span>
            <a href="#" className={styles.footerLink}>
              YouTube
            </a>
            <span className={styles.dot}>•</span>
            <a href="mailto:contact@northgroundbushcraft.com" className={styles.footerLink}>
              Email
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}