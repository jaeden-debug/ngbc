"use client";

import { useState } from "react";
import styles from "./SpeciesAuthorityPage.module.css";

export default function ShareSectionButton({ id, title, speciesName }: { id: string; title: string; speciesName?: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  async function share() {
    const url = new URL(window.location.href);
    url.hash = id;
    try {
      if (navigator.share) await navigator.share({ title: speciesName ? `${title} — ${speciesName}` : title, url: url.toString() });
      else {
        await navigator.clipboard.writeText(url.toString());
        setState("copied");
        window.setTimeout(() => setState("idle"), 1800);
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        await navigator.clipboard.writeText(url.toString());
        setState("copied");
        window.setTimeout(() => setState("idle"), 1800);
      }
    }
  }

  return <button type="button" className={styles.share} onClick={share} aria-label={`Share ${title} section`}>{state === "copied" ? "Copied" : "Share"}</button>;
}
