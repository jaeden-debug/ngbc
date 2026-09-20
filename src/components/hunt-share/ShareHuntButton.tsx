"use client";

import { useRef, useState } from "react";
import {
  copyHuntBriefLink,
  createHuntBriefRequestPayload,
  invokeNativeShare,
} from "../../lib/hunt-share/client.ts";
import type { HuntShareProjectionInput } from "../../lib/hunt-share/model.ts";
import styles from "./ShareHuntButton.module.css";

interface CreateResponse {
  ok?: boolean;
  code?: string;
  url?: string;
}

export default function ShareHuntButton({ huntResult }: { huntResult: HuntShareProjectionInput }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function ensureShareUrl(): Promise<string> {
    if (shareUrl) return shareUrl;
    const response = await fetch("/api/hunt/share", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(createHuntBriefRequestPayload(huntResult)),
    });
    const result = (await response.json().catch(() => ({}))) as CreateResponse;
    if (!response.ok || !result.ok || !result.url) {
      if (result.code === "RATE_LIMITED") throw new Error("Too many share attempts. Wait a few minutes and try again.");
      if (result.code === "INVALID_HUNT_RESULT") throw new Error("This Hunt result is not ready to share.");
      throw new Error("Hunt Brief sharing is temporarily unavailable.");
    }
    setShareUrl(result.url);
    return result.url;
  }

  async function prepareShareUrl() {
    setBusy(true);
    setMessage("");
    try {
      await ensureShareUrl();
      setMessage("Private Hunt Brief link ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hunt Brief sharing is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function openPreview() {
    dialogRef.current?.showModal();
    if (!shareUrl && !busy) void prepareShareUrl();
  }

  async function nativeShare() {
    if (!shareUrl) {
      await prepareShareUrl();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await invokeNativeShare(window.navigator, {
        title: `${huntResult.species.displayName} Hunt — ${huntResult.managementZone?.displayName ?? huntResult.jurisdiction.displayName}`,
        text: `${huntResult.selectedDate} · North Ground Hunt`,
        url: shareUrl,
      });
      if (result === "shared") setMessage("Hunt Brief shared.");
      if (result === "cancelled") setMessage("Sharing cancelled. Your link is ready if you still want to copy it.");
      if (result === "unsupported") setMessage("Device sharing is unavailable here. Use Copy Link instead.");
      if (result === "failed") setMessage("The device share sheet could not open. Use Copy Link instead.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hunt Brief sharing is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) {
      await prepareShareUrl();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await copyHuntBriefLink(window.navigator, shareUrl);
      setMessage(result === "copied" ? "Link copied." : "Copy failed. Select the link below and copy it manually.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hunt Brief sharing is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={styles.trigger} type="button" onClick={openPreview}>
        Share Hunt Brief
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="hunt-share-title">
        <div className={styles.content}>
          <div className={styles.top}>
            <div>
              <p className={styles.eyebrow}>Share this result</p>
              <h2 className={styles.title} id="hunt-share-title">Hunt Brief preview</h2>
            </div>
            <button className={styles.close} type="button" aria-label="Close share preview" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>

          <div className={styles.preview}>
            <strong>{huntResult.species.displayName}</strong>
            <span>{huntResult.managementZone?.displayName ?? "Management zone unresolved"} · {huntResult.jurisdiction.displayName}</span>
            <span>{huntResult.selectedDate} · {huntResult.regulatory.status.replaceAll("_", " ")}</span>
            {huntResult.location?.shareApproved && huntResult.location.generalLabel && <span>{huntResult.location.generalLabel}</span>}
          </div>

          <p className={styles.privacy}>
            Your exact coordinates, raw location input and private identifiers are not included. Only the jurisdiction, management zone and an explicitly approved general label can be shared.
          </p>

          <div className={styles.actions}>
            <button className={styles.button} type="button" disabled={busy} onClick={nativeShare}>
              Share from device
            </button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={copyLink}>
              Copy link
            </button>
          </div>
          <p className={styles.message} aria-live="polite" aria-atomic="true">{message}</p>
          {shareUrl && (
            <input
              className={styles.manualLink}
              aria-label="Hunt Brief link"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
