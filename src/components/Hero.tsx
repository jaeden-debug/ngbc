"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "../app/page.module.css";
import EnterButton from "./EnterButton";

/**
 * The hero sits in near-total darkness. A cone of light springs from just
 * below the bottom edge of the frame (where the hand holding the torch would
 * be) and lands wherever the cursor is — the beam reveals the footage inside
 * the pool and hangs in the air as haze along the way.
 */
type TiltApi = { enable: () => Promise<boolean>; disable: () => void };

/* device capability never changes for the life of the page */
const subscribeNever = () => () => {};
const readCanTilt = () =>
  "DeviceOrientationEvent" in window &&
  window.matchMedia("(pointer: coarse)").matches;

export default function Hero({ onEnter }: { onEnter: () => void }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const tiltRef = useRef<TiltApi | null>(null);

  const [tilting, setTilting] = useState(false);

  /* Only offer tilt where there is a sensor to read: a coarse pointer plus the
     orientation API. Desktop Chrome exposes the API with nothing behind it.
     Read through useSyncExternalStore so the server renders the button absent
     and the client fills it in without a cascading effect render. */
  const canTilt = useSyncExternalStore(subscribeNever, readCanTilt, () => false);

  const toggleTilt = useCallback(async () => {
    const api = tiltRef.current;
    if (!api) return;
    if (tilting) {
      api.disable();
      setTilting(false);
      return;
    }
    setTilting(await api.enable());
  }, [tilting]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = el.clientWidth || window.innerWidth;
    let h = el.clientHeight || window.innerHeight;

    /* the torch is held below frame, slightly behind the viewer */
    const BEAM_BASE = 1200; /* beam element's unscaled length, see CSS */
    let ox = w * 0.5;
    let oy = h * 1.24;

    /* tx/ty = where we want the light; cx/cy = where it actually is (it lags) */
    let tx = w * 0.5;
    let ty = h * 0.44;
    let cx = tx;
    let cy = ty;

    let pointing = false;
    let dragging = false;
    let drift = Math.random() * 10;
    let raf = 0;
    let holdTimer = 0;

    const paint = () => {
      const dx = cx - ox;
      const dy = cy - oy;
      const len = Math.max(140, Math.hypot(dx, dy));
      const rot = (Math.atan2(dy, dx) * 180) / Math.PI;

      /* the further the throw, the wider and weaker the pool */
      const reach = Math.min(1, len / (h * 1.35));

      const s = el.style;
      s.setProperty("--lx", `${cx.toFixed(1)}px`);
      s.setProperty("--ly", `${cy.toFixed(1)}px`);
      s.setProperty("--ox", `${ox.toFixed(1)}px`);
      s.setProperty("--oy", `${oy.toFixed(1)}px`);
      s.setProperty("--beam-rot", `${rot.toFixed(2)}deg`);
      s.setProperty("--beam-scale", (len / BEAM_BASE).toFixed(4));
      s.setProperty("--pool-scale", (0.78 + reach * 0.5).toFixed(3));
      s.setProperty("--pool-fade", (1 - reach * 0.35).toFixed(3));

      /* footage drifts against the beam so the frame feels handheld */
      s.setProperty("--px", `${(-(cx / w - 0.5) * 18).toFixed(2)}px`);
      s.setProperty("--py", `${(-(cy / h - 0.5) * 12).toFixed(2)}px`);
    };

    const measure = () => {
      w = el.clientWidth || window.innerWidth;
      h = el.clientHeight || window.innerHeight;
      ox = w * 0.5;
      oy = h * 1.24;
      paint();
    };

    if (reduce) {
      el.querySelector("video")?.pause();
      paint();
      return;
    }

    const tick = () => {
      if (!pointing) {
        /* nobody driving — sweep the beam slowly so the frame stays alive */
        drift += 0.0045;
        tx = w * (0.5 + 0.27 * Math.sin(drift));
        ty = h * (0.45 + 0.13 * Math.sin(drift * 1.63 + 1.2));
      }

      /* a mouse gets the heavy lag that makes the torch feel carried; a
         finger is direct manipulation, so it tracks much closer */
      const k = dragging ? 0.24 : 0.11;
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      paint();

      /* mouse parked and the beam has caught up → stop burning frames */
      if (pointing && Math.abs(tx - cx) < 0.25 && Math.abs(ty - cy) < 0.25) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    /* a fingertip covers the exact spot it is lighting, so on touch the pool
       lands a little above the contact point — you can see what you aim at */
    const TOUCH_LIFT = 78;

    const aim = (e: PointerEvent) => {
      const touch = e.pointerType !== "mouse";
      const r = el.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top - (touch ? TOUCH_LIFT : 0);
      dragging = touch;
      pointing = true;
      clearTimeout(holdTimer);
      wake();
    };

    /* touch: hold the beam where they left it, then ease back to sweeping
       rather than snapping away the instant they lift off */
    const endTouch = () => {
      dragging = false;
      clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        pointing = false;
        wake();
      }, 2600);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") endTouch();
    };

    /* a mouse only gives the beam back when it actually leaves the hero —
       releasing on click would send the light wandering on every press */
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return endTouch();
      pointing = false;
      dragging = false;
      wake();
    };

    /* ---- storm ---------------------------------------------------------
       Each strike is an envelope of [ms, brightness] points driving --storm,
       which lifts the veil and fires the sky wash. Hand-timed rather than a
       CSS loop so the flicker is irregular and the gaps are unpredictable. */
    type Pt = [number, number];

    const STRIKES: Pt[][] = [
      /* distant sheet lightning — slow, soft, no forks */
      [[0, 0], [110, .26], [300, .09], [470, .18], [980, 0]],
      /* close strike — sharp snap, triple flicker, long decay */
      [[0, 0], [32, 1], [90, .16], [126, .88], [186, .10], [258, .58], [370, .07], [520, .28], [980, 0]],
      /* quick snap, single re-strike */
      [[0, 0], [38, .72], [112, .09], [172, .46], [420, 0]],
      /* far horizon glow */
      [[0, 0], [220, .14], [640, .05], [1100, 0]],
    ];

    let strikeRaf = 0;
    let strikeTimer = 0;

    const runStrike = (pts: Pt[]) => {
      const t0 = performance.now();
      const dur = pts[pts.length - 1][0];

      const step = (now: number) => {
        const t = now - t0;
        if (t >= dur) {
          el.style.setProperty("--storm", "0");
          strikeRaf = 0;
          return;
        }
        let i = 1;
        while (i < pts.length && pts[i][0] < t) i++;
        const [ta, va] = pts[i - 1];
        const [tb, vb] = pts[i];
        const k = tb === ta ? 1 : (t - ta) / (tb - ta);
        el.style.setProperty("--storm", (va + (vb - va) * k).toFixed(3));
        strikeRaf = requestAnimationFrame(step);
      };
      strikeRaf = requestAnimationFrame(step);
    };

    const scheduleStrike = (min: number, span: number) => {
      strikeTimer = window.setTimeout(() => {
        const quiet = document.hidden || document.documentElement.dataset.deck === "1";
        if (!quiet) runStrike(STRIKES[(Math.random() * STRIKES.length) | 0]);
        scheduleStrike(7000, 15000);
      }, min + Math.random() * span);
    };

    /* ---- tilt to aim ---------------------------------------------------
       Pitch and roll steer the beam, measured against whatever position the
       phone was in when tilt was switched on, so it works however it's held.
       A finger always wins while it's down. */
    let tiltOn = false;
    let baseBeta = 0;
    let baseGamma = 0;
    let calibrated = false;

    const clamp = (v: number, lo: number, hi: number) =>
      v < lo ? lo : v > hi ? hi : v;

    const SWING_X = 30; /* degrees of roll for a full sweep left↔right */
    const SWING_Y = 26; /* degrees of pitch for a full sweep up↕down */

    const onOrient = (e: DeviceOrientationEvent) => {
      if (!tiltOn || dragging) return;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      if (!calibrated) {
        baseBeta = beta;
        baseGamma = gamma;
        calibrated = true;
        return;
      }

      let dx = clamp(gamma - baseGamma, -SWING_X, SWING_X) / SWING_X;
      let dy = clamp(beta - baseBeta, -SWING_Y, SWING_Y) / SWING_Y;

      /* the sensor axes are fixed to the device, so remap them when the
         screen itself has rotated */
      const angle = window.screen?.orientation?.angle ?? 0;
      if (angle === 90) [dx, dy] = [dy, -dx];
      else if (angle === 270 || angle === -90) [dx, dy] = [-dy, dx];
      else if (angle === 180) [dx, dy] = [-dx, -dy];

      tx = w * (0.5 + dx * 0.46);
      ty = h * (0.45 + dy * 0.34);
      pointing = true;
      clearTimeout(holdTimer);
      wake();
    };

    tiltRef.current = {
      enable: async () => {
        /* iOS 13+ only hands over the sensor from inside a user gesture */
        const DOE = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<PermissionState | string>;
        };
        if (typeof DOE?.requestPermission === "function") {
          try {
            if ((await DOE.requestPermission()) !== "granted") return false;
          } catch {
            return false;
          }
        }
        calibrated = false;
        tiltOn = true;
        window.addEventListener("deviceorientation", onOrient);
        wake();
        return true;
      },
      disable: () => {
        tiltOn = false;
        calibrated = false;
        pointing = false;
        window.removeEventListener("deviceorientation", onOrient);
        wake();
      },
    };

    const onVisibility = () => (document.hidden ? sleep() : wake());

    paint();
    wake();
    /* first one lands just after the darkness settles, so it reads as weather
       rather than a loading glitch */
    scheduleStrike(4200, 3500);

    el.addEventListener("pointerdown", aim, { passive: true });
    el.addEventListener("pointermove", aim, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      sleep();
      if (strikeRaf) cancelAnimationFrame(strikeRaf);
      clearTimeout(strikeTimer);
      clearTimeout(holdTimer);
      window.removeEventListener("deviceorientation", onOrient);
      tiltRef.current = null;
      el.removeEventListener("pointerdown", aim);
      el.removeEventListener("pointermove", aim);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.hero} aria-label="Hero">
      <nav className={styles.primaryNav} aria-label="Primary navigation">
        <Link className={styles.navBrand} href="/" aria-current="page">
          North Ground
        </Link>
        <div className={styles.navLinks}>
          <Link href="/tools/season-finder">Hunt</Link>
          <Link href="/hunting/species/ruffed-grouse">Species guide</Link>
        </div>
      </nav>

      {/* AV1 first — roughly half the bytes of H.264 at the same quality.
          Anything that can't decode it falls through to the H.264 cut. */}
      <video
        className={styles.heroVideo}
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source
          src="/videos/hero-mobile.av1.mp4"
          type='video/mp4; codecs="av01.0.08M.08"'
          media="(max-width: 520px)"
        />
        <source
          src="/videos/hero-mobile.mp4"
          type='video/mp4; codecs="avc1.640028"'
          media="(max-width: 520px)"
        />
        <source
          src="/videos/hero-desktop.av1.mp4"
          type='video/mp4; codecs="av01.0.08M.08"'
        />
        <source
          src="/videos/hero-desktop.mp4"
          type='video/mp4; codecs="avc1.640029"'
        />
      </video>

      {/* the mark sits in the scene, under the dark — the torch finds it */}
      <Image
        className={styles.heroMark}
        src="/logo-mark.webp"
        alt="North Ground Bushcraft"
        width={820}
        height={862}
        sizes="(max-width: 520px) 66vw, (max-width: 900px) 40vw, 26vw"
        priority
        draggable={false}
      />

      {/* darkness with a hole punched where the beam lands */}
      <div className={styles.veil} aria-hidden="true" />

      {/* the shaft of light hanging in the air */}
      <div className={styles.beam} aria-hidden="true" />

      {/* hot spot where the beam hits */}
      <div className={styles.pool} aria-hidden="true" />

      {/* storm — sky wash on every strike */}
      <div className={styles.lightning} aria-hidden="true" />

      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.cursorFx} aria-hidden="true" />

      <div className={styles.heroInner}>
        <div className={styles.heroCtaStack}>
          <p className={styles.heroTagline}>Learning the land, one trip at a time.</p>
          <EnterButton onEnter={onEnter} />
        </div>
      </div>

      {canTilt && (
        <button
          type="button"
          className={`${styles.tiltBtn} ${tilting ? styles.tiltOn : ""}`}
          onClick={toggleTilt}
          aria-pressed={tilting}
        >
          <span className={styles.tiltDot} aria-hidden="true" />
          {tilting ? "Tilting" : "Tilt to aim"}
        </button>
      )}

      <div className={styles.scrollHint} aria-hidden="true">
        <span className={styles.scrollLine} />
      </div>
    </section>
  );
}
