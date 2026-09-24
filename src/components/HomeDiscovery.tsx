import Link from "next/link";
import styles from "../app/page.module.css";

export default function HomeDiscovery() {
  return (
    <section className={styles.discovery} aria-labelledby="north-ground-heading">
      <div className={styles.discoveryWrap}>
        <header className={styles.discoveryIntro}>
          <p className={styles.discoveryEyebrow}>North Ground</p>
          <h1 id="north-ground-heading" className={styles.discoveryTitle}>
            Canadian hunting knowledge, built for the field.
          </h1>
          <p className={styles.discoveryLead}>
            North Ground brings hunting zones, species knowledge and sourced
            regulatory information into practical tools for the Canadian outdoors.
          </p>
        </header>

        <div className={styles.discoveryProduct}>
          <div className={styles.discoveryProductCopy}>
            <p className={styles.discoveryKicker}>North Ground Hunt</p>
            <h2 className={styles.discoveryProductTitle}>
              Start with the place. Check the hunt.
            </h2>
            <p className={styles.discoveryText}>
              Find your hunting zone, choose a species and date, and check what
              North Ground&apos;s supported regulatory data says for that hunt.
              Results keep their source context and limitations visible.
            </p>
          </div>

          <div className={styles.discoveryActions}>
            <Link className={styles.discoveryPrimary} href="/hunt">
              Open North Ground Hunt
              <span aria-hidden="true">→</span>
            </Link>

            <Link className={styles.discoverySecondary} href="/hunting/species">
              Browse the species library
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className={styles.discoverySteps} aria-label="North Ground hunting resources">
          <div className={styles.discoveryStep}>
            <span className={styles.discoveryStepLabel}>Zone</span>
            <p>Find the management area for a location.</p>
          </div>

          <div className={styles.discoveryStep}>
            <span className={styles.discoveryStepLabel}>Species</span>
            <p>Browse identification and field knowledge.</p>
          </div>

          <div className={styles.discoveryStep}>
            <span className={styles.discoveryStepLabel}>Season</span>
            <p>Check supported regulatory information by species and date.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
