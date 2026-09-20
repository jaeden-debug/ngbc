"use client";

import { useEffect, useState } from "react";
import styles from "../app/page.module.css";
import Hero from "./Hero";
import MissionDeck from "./MissionDeck";
import NewsletterForm from "./NewsletterForm";

export default function HomePageClient() {
  const [deckOpen, setDeckOpen] = useState(false);
  const [deckKey, setDeckKey] = useState(0);

  useEffect(() => {
    if (deckOpen) document.documentElement.dataset.deck = "1";
    else delete document.documentElement.dataset.deck;
  }, [deckOpen]);

  const openDeck = () => {
    setDeckKey((key) => key + 1);
    setDeckOpen(true);
  };

  const closeDeck = () => {
    setDeckOpen(false);
    requestAnimationFrame(() => {
      // Focus returns to the control that opened the deck, which is now the
      // secondary story button rather than the Hunt link.
      document.getElementById("story-btn")?.focus();
    });
  };

  return (
    <main className={styles.page}>
      <Hero onStory={openDeck} />

      {deckOpen && <MissionDeck open deckKey={deckKey} onClose={closeDeck} />}

      <footer id="after-deck" className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <span className={styles.label}>Contact</span>
            <span className={styles.rule} />
          </div>

          <h2 className={styles.h2}>Get updates when we drop new field work</h2>
          <p className={styles.p}>
            Occasional updates — new uploads, gear we trust, and what we’re testing next.
          </p>

          <NewsletterForm />

          <div className={styles.footerMeta}>
            <span>© {new Date().getFullYear()} North Ground Bushcraft</span>
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
