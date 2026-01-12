import styles from "./page.module.css";
import Hero from "../components/Hero";
import NewsletterForm from "../components/NewsletterForm";
import SectionButtons from "../components/SectionButtons";

export default function Page() {
  return (
    <main className={styles.page}>
      {/* HERO (VIDEO) */}
      <Hero />

      {/* SECTION 2: MISSION / WHAT WE DO */}
      <section id="mission" className={styles.about}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <span className={styles.label}>Mission</span>
            <span className={styles.rule} />
          </div>

          <h2 className={styles.h2}>Canada. Cold. Real field tests.</h2>

          <p className={styles.p}>
            <strong>North Ground Bushcraft</strong> documents our bushcraft, camping, and hunting
            adventures across Canada — winter camps, challenges, survival practice, and exploration.
            No studio setups. No fake “survival.” Just real conditions, real lessons, and the gear
            that either holds up… or fails.
          </p>

          <ul className={styles.list}>
            <li>
              <strong>Adventures:</strong> winter camping, overnights, deep-woods exploration.
            </li>
            <li>
              <strong>Challenges:</strong> endurance, shelter builds, fire, food, navigation.
            </li>
            <li>
              <strong>Gear:</strong> honest reviews, pack lists, what we’d buy again.
            </li>
            <li>
              <strong>Learning:</strong> we’re students too — follow the journey and level up with us.
            </li>
          </ul>

          <SectionButtons />
        </div>
      </section>

      {/* SECTION 3: CREW */}
      <section id="crew" className={styles.about}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <span className={styles.label}>Crew</span>
            <span className={styles.rule} />
          </div>

          <h2 className={styles.h2}>Jaeden Doody & Laith Halwani</h2>

          <div className={styles.crewGrid}>
            <article className={styles.card}>
              <h3 className={styles.h3}>Jaeden Doody</h3>
              <p className={styles.p}>
                I’m Jaeden — a Canadian outdoorsman, father, and builder at heart. I’ve always chased
                hard environments and harder challenges: winter camps, long hikes, and field skills
                that actually matter when the weather turns. This channel is the record of that
                obsession — testing ourselves, improving fast, and documenting what works in real
                northern conditions.
              </p>

              <ul className={styles.list}>
                <li>
                  <strong>Focus:</strong> winter systems, shelter, navigation, resilience
                </li>
                <li>
                  <strong>Style:</strong> cinematic field footage, honest results
                </li>
                <li>
                  <strong>Search:</strong> “Jaeden Doody” + “North Ground Bushcraft”
                </li>
              </ul>
            </article>

            <article className={styles.card}>
              <h3 className={styles.h3}>Laith Halwani</h3>
              <p className={styles.p}>
                Laith is the calm one — laid-back, bushcraft-minded, and built for slow, deliberate
                progress in the woods. He’ll drop his official story here soon. For now, expect a
                clean bushcraft style: fire craft, shelter craft, and the kind of patience that
                makes the whole camp run smoother.
              </p>

              <ul className={styles.list}>
                <li>
                  <strong>Focus:</strong> bushcraft fundamentals, camp systems, gear use
                </li>
                <li>
                  <strong>Search:</strong> “Laith Halwani” + “North Ground Bushcraft”
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* FOOTER / CONTACT */}
      <footer id="contact" className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <span className={styles.label}>Contact</span>
            <span className={styles.rule} />
          </div>

          <h2 className={styles.h2}>Get updates when we drop new field work</h2>
          <p className={styles.p}>
            We’ll send occasional updates — new uploads, gear we trust, and what we’re testing next.
          </p>

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