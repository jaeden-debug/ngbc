"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./HuntNav.module.css";

/**
 * Hunt's floating navigation.
 *
 * Every destination here is a route that exists. The approved layout also showed
 * Learn, Gear and Community; those have no pages yet, and a premium interface that
 * navigates to nothing is worse than a short one, so they are omitted until they
 * are real rather than shipped as dead links.
 */
const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/hunt", label: "Hunt" },
  { href: "/hunting/species", label: "Species" },
];

/**
 * Which destination this navigation is currently sitting on.
 *
 * The species library and species profiles carry the same navigation as Hunt —
 * they are the same product, and a person moving between them has not changed
 * sites. Callers pass the section they belong to rather than the exact URL, so a
 * profile at `/hunting/species/moose` still marks `Species` as current.
 */
export default function HuntNav({ current = "/hunt" }: { current?: string } = {}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* The compact menu is a disclosure, so Escape closes it and focus returns to the
     control that opened it. An outside pointer press closes it too. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={`${styles.navInner} ng-glass-overlay`}>
        <Link className={styles.brand} href="/">
          {/* The approved North Ground mark, served small: the crest is 820x862 and
              is rendered at 38 CSS pixels, so `sizes` keeps the download tiny. */}
          <Image
            className={styles.brandMark}
            src="/logo-mark.webp"
            alt=""
            width={820}
            height={862}
            sizes="44px"
            priority
            draggable={false}
          />
          <span className={styles.brandText}>
            <span className={styles.brandName}>North Ground</span>
            <span className={styles.brandSub}>Hunt</span>
          </span>
          <span className="ng-visually-hidden">North Ground Hunt — return to North Ground</span>
        </Link>

        <nav className={styles.navLinks} aria-label="Hunt">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              className={styles.navLink}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
              data-current={link.href === current ? "true" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className={styles.navToggle}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="ng-visually-hidden">{open ? "Close menu" : "Menu"}</span>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
            {open ? (
              <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            ) : (
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className={`${styles.navMenu} ng-glass-popover`} id={menuId} ref={menuRef}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              className={styles.navMenuLink}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
              data-current={link.href === current ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
