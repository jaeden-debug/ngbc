"use client";

import { useState } from "react";
import styles from "../app/page.module.css";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();

    if (!value) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });

      if (!res.ok) throw new Error("Bad response");

      setStatus("success");
      setEmail("");
      setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <form className={styles.newsletter} onSubmit={onSubmit}>
      <input
        className={styles.input}
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        required
      />

      <button className={styles.submit} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Join"}
      </button>

      <div className={styles.formMsg} aria-live="polite">
        {status === "success" && <span className={styles.ok}>Locked in. Welcome.</span>}
        {status === "error" && <span className={styles.err}>Try again in a sec.</span>}
      </div>
    </form>
  );
}