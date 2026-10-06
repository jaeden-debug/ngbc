"use client";

import { useEffect, useState } from "react";
import type { AuthoritySectionId } from "../../lib/species-authority/types";
import styles from "./SpeciesAuthorityPage.module.css";

export default function AuthorityNavigator({ items }: { items: Array<{ id: AuthoritySectionId; label: string }> }) {
  const [active, setActive] = useState<AuthoritySectionId>(items[0]?.id ?? "overview");

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(({ isIntersecting }) => isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id as AuthoritySectionId);
    }, { rootMargin: "-28% 0px -62%", threshold: 0 });
    for (const { id } of items) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.navigator} aria-label="On this page">
      <div className={styles.navigatorTrack}>
        {items.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className={styles.navigatorLink} aria-current={active === id ? "location" : undefined}>{label}</a>
        ))}
      </div>
    </nav>
  );
}
