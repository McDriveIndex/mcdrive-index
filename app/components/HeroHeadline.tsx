"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import styles from "./HeroHeadline.module.css";

const LOOP_MS = 1300;
const CHECKER_MAX_COLS = 24;
const CHECKER_ROWS = 4;

type HeroHeadlineProps = {
  onFrameWidth?: (px: number) => void;
};

export default function HeroHeadline({ onFrameWidth }: HeroHeadlineProps) {
  const [index, setIndex] = useState(0);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [orWorseScale, setOrWorseScale] = useState(1);
  const [headlineScale, setHeadlineScale] = useState(1);
  const [layoutNonce, bumpLayoutNonce] = useReducer((x: number) => x + 1, 0);
  const [checkerCols, setCheckerCols] = useState(CHECKER_MAX_COLS);
  const btcMeasurerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const orWorseMeasureRef = useRef<HTMLDivElement | null>(null);
  const orWorseHiddenRef = useRef<HTMLDivElement | null>(null);
  const headlineBoxRef = useRef<HTMLDivElement | null>(null);
  const headlineTextMeasureRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % 3);
    }, LOOP_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    didMountRef.current = true;
  }, []);

  useEffect(() => {
    let raf = 0;

    const kickLayout = () => {
      bumpLayoutNonce();
      raf = window.requestAnimationFrame(() => bumpLayoutNonce());
    };

    const onOrientationChange = () => kickLayout();
    const onPageShow = () => kickLayout();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") kickLayout();
    };
    const onFocus = () => kickLayout();

    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    const measure = () => {
      const measuredBtcWidth = btcMeasurerRef.current?.getBoundingClientRect().width ?? 0;
      if (measuredBtcWidth > 0 && !cancelled) {
        const TILE = 32;
        const PAD = 64;
        const raw = Math.ceil(measuredBtcWidth) + PAD;
        const snapped = Math.ceil(raw / TILE) * TILE;
        const maxByViewport = Math.floor(window.innerWidth * 0.8);
        const clamped = Math.min(snapped, 1000, maxByViewport > 0 ? maxByViewport : snapped);
        setFrameWidth(clamped);
      }
    };

    const run = async () => {
      if ("fonts" in document) {
        try {
          await (document as any).fonts.ready;
        } catch {
          // no-op
        }
      }
      measure();
    };

    void run();
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [layoutNonce]);

  useEffect(() => {
    if (frameWidth != null) {
      onFrameWidth?.(frameWidth);
    }
  }, [frameWidth, onFrameWidth]);

  useEffect(() => {
    let rafId = 0;

    const updateCheckerCols = () => {
      // Keep mobile checker columns aligned to whole cells to reduce DPR/subpixel clipping on iOS.
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (!isMobile) {
        setCheckerCols((prev) => (prev === CHECKER_MAX_COLS ? prev : CHECKER_MAX_COLS));
        rafId = 0;
        return;
      }
      const cell = 14;
      const availableWidth = frameWidth ?? Math.floor(window.innerWidth * 0.8);
      let cols = Math.min(CHECKER_MAX_COLS, Math.floor(availableWidth / cell));
      cols = Math.max(8, cols);
      if (cols % 2 === 1 && cols > 8) cols -= 1;

      setCheckerCols((prev) => (prev === cols ? prev : cols));
      rafId = 0;
    };

    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updateCheckerCols);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [frameWidth, layoutNonce]);

  useLayoutEffect(() => {
    const measureOrWorseScale = () => {
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      const availableWidth = isMobile
        ? (headlineBoxRef.current?.clientWidth ?? 0)
        : (frameRef.current?.clientWidth ?? 0);
      const SAFETY_PX = 12;
      const inner = Math.max(0, availableWidth - SAFETY_PX);
      const ww = orWorseHiddenRef.current?.getBoundingClientRect().width ?? 0;
      if (inner > 0 && ww > 0) {
        const next = Number(Math.min(1, inner / ww).toFixed(4));
        setOrWorseScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
      } else {
        setOrWorseScale((prev) => (prev === 1 ? prev : 1));
      }
    };
    measureOrWorseScale();

    let raf = 0;
    const onResize = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measureOrWorseScale);
    };

    window.addEventListener("resize", onResize);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      viewport?.removeEventListener("resize", onResize);
    };
  }, [index, frameWidth, layoutNonce]);

  useLayoutEffect(() => {
    if (index === 2) {
      setHeadlineScale((prev) => (prev === 1 ? prev : 1));
      return;
    }

    const measure = () => {
      const box = headlineBoxRef.current;
      const el = headlineTextMeasureRef.current;
      const available = box?.clientWidth ?? 0;
      const measured = el ? el.scrollWidth : 0;
      if (measured > 0 && available > 0) {
        const safetyPx = 6;
        const scale = Math.max(0.75, Math.min(1, (available - safetyPx) / measured));
        setHeadlineScale((prev) => (Math.abs(prev - scale) > 0.002 ? scale : prev));
      } else {
        setHeadlineScale((prev) => (prev === 1 ? prev : 1));
      }
    };

    measure();

    let raf = 0;
    const onResize = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    window.addEventListener("resize", onResize);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      viewport?.removeEventListener("resize", onResize);
    };
  }, [index, checkerCols, frameWidth, layoutNonce]);

  const renderHeadline = (variantIndex: number, forMeasure = false) => {
    if (variantIndex === 0) {
      return <div className={forMeasure ? styles.oneLineMeasure : styles.oneLine}>1 BTC</div>;
    }
    if (variantIndex === 1) {
      return <div className={forMeasure ? styles.oneLineMeasure : styles.oneLine}>1 CAR</div>;
    }
    return (
      <div
        ref={forMeasure ? undefined : orWorseMeasureRef}
        className={styles.orWorse}
        style={forMeasure ? undefined : { transform: `scale(${orWorseScale})` }}
      >
        <div className={styles.or}>OR</div>
        <div className={styles.worse}>WORSE</div>
      </div>
    );
  };

  const checkerCells = useMemo(
    () =>
      Array.from({ length: checkerCols * CHECKER_ROWS }, (_, i) => {
        const isBlack = ((Math.floor(i / checkerCols) + (i % checkerCols)) % 2) === 0;
        return <span key={i} className={`${styles.cell} ${isBlack ? styles.black : ""}`} />;
      }),
    [checkerCols]
  );

  const variantScale = index === 2 ? 1 : headlineScale;

  return (
    <section className={styles.hero} aria-label="Hero headline">
      <div className={styles.hiddenMeasure} aria-hidden="true">
        <div ref={orWorseHiddenRef} className={styles.orWorse}>
          <div className={styles.or}>OR</div>
          <div className={styles.worse}>WORSE</div>
        </div>
      </div>

      <div className={styles.stack}>
        <div className={styles.measurer} aria-hidden="true">
          <div ref={btcMeasurerRef} className={styles.oneLine}>1 BTC</div>
        </div>

        <div
          ref={frameRef}
          className={styles.frame}
          style={frameWidth ? { width: `${frameWidth}px` } : undefined}
        >
          <div className={styles.checker} aria-hidden="true">
            <div
              className={styles.checkerCells}
              style={{ ["--checker-cols" as any]: String(checkerCols) }}
              aria-hidden="true"
            >
              {checkerCells}
            </div>
          </div>

          <div
            className={styles.headlineArea}
            style={{ ["--checker-cols" as any]: String(checkerCols) }}
          >
            <div className={styles.headlineInner} ref={headlineBoxRef}>
              <div className={styles.headlineMeasurer} aria-hidden="true">
                <div ref={headlineTextMeasureRef} className={styles.headlineMeasureContent}>
                  {renderHeadline(index, true)}
                </div>
              </div>
              <div className={styles.headlineCenter}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={index}
                    initial={didMountRef.current ? { opacity: 0, y: 18 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    transition={{ duration: 0.18, ease: "linear" }}
                  >
                    <div
                      className={styles.headlineScaled}
                      style={{ transform: `scale(${variantScale})` }}
                    >
                      {renderHeadline(index)}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className={styles.checker} aria-hidden="true">
            <div
              className={styles.checkerCells}
              style={{ ["--checker-cols" as any]: String(checkerCols) }}
              aria-hidden="true"
            >
              {checkerCells}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
