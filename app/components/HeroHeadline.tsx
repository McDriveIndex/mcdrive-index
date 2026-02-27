"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./HeroHeadline.module.css";

const LOOP_MS = 1300;
const CHECKER_COLS = 24;
const CHECKER_ROWS = 4;
const CHECKER_CELLS = CHECKER_COLS * CHECKER_ROWS;

type HeroHeadlineProps = {
  onFrameWidth?: (px: number) => void;
};

export default function HeroHeadline({ onFrameWidth }: HeroHeadlineProps) {
  const [index, setIndex] = useState(0);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [orWorseScale, setOrWorseScale] = useState(1);
  const btcMeasurerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const orWorseMeasureRef = useRef<HTMLDivElement | null>(null);
  const orWorseHiddenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % 3);
    }, LOOP_MS);
    return () => window.clearInterval(timer);
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
  }, []);

  useEffect(() => {
    if (frameWidth != null) {
      onFrameWidth?.(frameWidth);
    }
  }, [frameWidth, onFrameWidth]);

  useLayoutEffect(() => {
    const measureOrWorseScale = () => {
      if (index !== 2) {
        setOrWorseScale(1);
        return;
      }

      const fw = frameRef.current?.clientWidth ?? 0;
      const INNER_PAD = 16;
      const inner = Math.max(0, fw - INNER_PAD);
      const ww = orWorseHiddenRef.current?.getBoundingClientRect().width ?? 0;
      if (inner > 0 && ww > 0) {
        const s = Math.min(1, inner / ww);
        setOrWorseScale(Number(s.toFixed(4)));
      } else {
        setOrWorseScale(1);
      }
    };

    if (index !== 2) {
      setOrWorseScale(1);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        measureOrWorseScale();
      });
    });

    const onResize = () => {
      if (index === 2) measureOrWorseScale();
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("resize", onResize);
    };
  }, [index, frameWidth]);

  const variants = useMemo(
    () => [
      <div key="btc" className={styles.oneLine}>1 BTC</div>,
      <div key="car" className={styles.oneLine}>1 CAR</div>,
      <div
        key="or-worse"
        ref={orWorseMeasureRef}
        className={styles.orWorse}
        style={{ transform: `scale(${orWorseScale})` }}
      >
        <div className={styles.or}>OR</div>
        <div className={styles.worse}>WORSE</div>
      </div>,
    ],
    [orWorseScale]
  );

  const checkerCells = useMemo(
    () =>
      Array.from({ length: CHECKER_CELLS }, (_, i) => {
        const isBlack = ((Math.floor(i / CHECKER_COLS) + (i % CHECKER_COLS)) % 2) === 0;
        return <span key={i} className={`${styles.cell} ${isBlack ? styles.black : ""}`} />;
      }),
    []
  );

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
            <div className={styles.checkerCells} aria-hidden="true">
              {checkerCells}
            </div>
          </div>

          <div className={styles.headlineArea}>
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.18, ease: "linear" }}
              >
                {variants[index]}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className={styles.checker} aria-hidden="true">
            <div className={styles.checkerCells} aria-hidden="true">
              {checkerCells}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
