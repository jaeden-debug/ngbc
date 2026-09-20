"use client";

import { useState } from "react";
import styles from "../app/page.module.css";

type ApiResult = {
  ok?: boolean;
  code?: string;
};

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();

    if (!value) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: value, website: "" }),
      });
      const result = (await res.json().catch(() => ({}))) as ApiResult;

      if (!res.ok || !result.ok) {
        if (result.code === "INVALID_EMAIL") {
          setMessage("Enter a valid email address.");
        } else if (result.code === "RATE_LIMITED") {
          setMessage("Too many attempts. Please wait a few minutes and try again.");
        } else if (result.code === "SERVICE_UNAVAILABLE") {
          setMessage("Updates aren’t available right now. Please try again later.");
        } else {
          setMessage("We couldn’t save your subscription. Please try again.");
        }
        setStatus("error");
        return;
      }

      setStatus("success");
      setMessage("You’re subscribed. Welcome to North Ground.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("We couldn’t reach the subscription service. Please try again.");
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
        aria-label="Email address"
        aria-describedby="newsletter-status"
        aria-invalid={status === "error"}
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        required
      />

      <button className={styles.submit} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Join"}
      </button>

      <div id="newsletter-status" className={styles.formMsg} aria-live="polite" aria-atomic="true">
        {status === "success" && <span className={styles.ok}>{message}</span>}
        {status === "error" && <span className={styles.err}>{message}</span>}
      </div>
    </form>
  );
}
