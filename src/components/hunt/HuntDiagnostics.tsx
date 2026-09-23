"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORARY. A geometry readout for measuring on a real device.
 *
 * Rendered only for `?diag=1`, because the thing being debugged — iOS Safari's
 * keyboard and visual viewport — cannot be reproduced in a desktop emulator,
 * where the layout and visual viewports are the same object. Everything here is
 * read, never set.
 *
 * Delete with the fix.
 */
export default function HuntDiagnostics() {
  const [text, setText] = useState("");

  useEffect(() => {
    const scrollableAncestors = () => {
      const found: string[] = [];
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("html, body, [class]"))) {
        const overflowY = getComputedStyle(element).overflowY;
        const scrolls = element.scrollHeight > element.clientHeight + 2;
        if (!scrolls || overflowY === "visible" || overflowY === "hidden" || overflowY === "clip") continue;
        const name = element.tagName.toLowerCase() + (element.className ? `.${String(element.className).split(" ")[0].slice(-22)}` : "");
        found.push(`${name} ${element.scrollHeight}/${element.clientHeight}@${element.scrollTop}`);
      }
      return found.slice(0, 6);
    };

    const read = () => {
      const view = window.visualViewport;
      const sheet = document.querySelector<HTMLElement>("section[data-layout]");
      const rect = sheet?.getBoundingClientRect();
      const body = sheet?.querySelector<HTMLElement>("[data-scroll='true']")
        ?? Array.from(sheet?.querySelectorAll<HTMLElement>("*") ?? []).find((el) => getComputedStyle(el).overflowY === "auto");
      const root = document.querySelector<HTMLElement>("[data-hunt-root]") ?? document.body;
      const styles = getComputedStyle(root);
      const active = document.activeElement;
      const field = document.querySelector<HTMLElement>("input[type='search']")?.getBoundingClientRect();
      const bandTop = Math.round(view?.offsetTop ?? 0);
      const bandBottom = bandTop + Math.round(view?.height ?? window.innerHeight);

      setText([
        `inner ${window.innerHeight}  vv ${Math.round(view?.height ?? -1)} @${bandTop}  scrollY ${Math.round(window.scrollY)}`,
        `band [${bandTop},${bandBottom}]`,
        `sheet [${Math.round(rect?.top ?? -1)},${Math.round(rect?.bottom ?? -1)}] h${Math.round(rect?.height ?? -1)} snap=${sheet?.dataset.snap}`,
        `TOP ABOVE BAND: ${rect ? (rect.top < bandTop - 1 ? `YES by ${Math.round(bandTop - rect.top)}` : "no") : "?"}`,
        `--sheet-full ${styles.getPropertyValue("--sheet-full").trim() || "unset"}  --sheet-h ${styles.getPropertyValue("--sheet-h").trim() || "unset"}`,
        `--viewport-top ${styles.getPropertyValue("--viewport-top").trim() || "unset"}  --viewport-gap ${styles.getPropertyValue("--viewport-gap").trim() || "unset"}`,
        `scroller ${body ? `${body.scrollHeight}/${body.clientHeight}@${Math.round(body.scrollTop)}` : "none"}`,
        `field [${Math.round(field?.top ?? -1)},${Math.round(field?.bottom ?? -1)}] visible=${field ? field.top >= bandTop - 1 && field.bottom <= bandBottom + 1 : "?"}`,
        `active ${active?.tagName}${active === document.querySelector("input[type='search']") ? " (THE FIELD)" : ""}`,
        `scrollables: ${scrollableAncestors().join(" | ") || "none"}`,
      ].join("\n"));
    };

    read();
    const timer = window.setInterval(read, 250);
    const view = window.visualViewport;
    view?.addEventListener("resize", read);
    view?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(timer);
      view?.removeEventListener("resize", read);
      view?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  return (
    <pre
      style={{
        position: "fixed", zIndex: 2147483647, left: 0, right: 0, top: 0,
        margin: 0, padding: "4px 6px", font: "700 9px/1.25 ui-monospace, monospace",
        color: "#0f0", background: "rgba(0,0,0,0.88)", whiteSpace: "pre-wrap", pointerEvents: "none",
      }}
    >
      {text}
    </pre>
  );
}
