"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSignIn() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="ng-glass-panel"
      style={{ maxWidth: 480, margin: "10vh auto", padding: 24 }}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const data = new FormData(event.currentTarget);
        const response = await fetch("/api/admin/species-media/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
        }).catch(() => null);
        setBusy(false);
        if (!response?.ok) {
          setError(response?.status === 503 ? "Admin sign-in is not configured." : "Sign-in failed.");
          return;
        }
        router.replace("/hunting/species");
        router.refresh();
      }}
    >
      <p className="ng-eyebrow">North Ground administration</p>
      <h1 style={{ margin: "8px 0 18px" }}>Species media</h1>
      <label className="ng-label" htmlFor="admin-email">Email</label>
      <input id="admin-email" name="email" type="email" autoComplete="username" required className="ng-glass-control" style={{ width: "100%", minHeight: 48, margin: "6px 0 16px", padding: "0 12px" }} />
      <label className="ng-label" htmlFor="admin-password">Password</label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="ng-glass-control" style={{ width: "100%", minHeight: 48, margin: "6px 0 18px", padding: "0 12px" }} />
      <button className="ng-action" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      {error ? <p role="alert" style={{ marginTop: 14 }}>{error}</p> : null}
    </form>
  );
}
