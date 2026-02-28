"use client";

import { useEffect } from "react";

export default function IosScrollStabilizer() {
  useEffect(() => {
    const scrollOpts: AddEventListenerOptions = { passive: true };
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {
      // no-op
    }

    let armedUntil = 0;
    let lastNonZeroY = 0;
    let rafId = 0;
    let stopRequested = false;

    const stopAll = () => {
      stopRequested = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const watch = () => {
      if (stopRequested) return;

      const now = performance.now();
      const y = window.scrollY;

      if (y > 0) {
        lastNonZeroY = y;
      }

      if (y === 0 && lastNonZeroY > 0) {
        window.scrollTo(0, lastNonZeroY);
      }

      if (now > armedUntil) {
        stopAll();
        return;
      }

      rafId = window.requestAnimationFrame(watch);
    };

    const armAfterRotate = () => {
      stopAll();
      stopRequested = false;
      armedUntil = performance.now() + 1500;
      lastNonZeroY = 0;
      rafId = window.requestAnimationFrame(watch);
    };

    const onScroll = () => {
      const y = window.scrollY;
      if (y > 0) lastNonZeroY = y;
    };

    const onTouchStart = () => stopAll();

    window.addEventListener("orientationchange", armAfterRotate);
    window.addEventListener("resize", armAfterRotate);
    window.addEventListener("scroll", onScroll, scrollOpts);
    window.addEventListener("touchstart", onTouchStart, { passive: true });

    return () => {
      stopAll();
      window.removeEventListener("orientationchange", armAfterRotate);
      window.removeEventListener("resize", armAfterRotate);
      window.removeEventListener("scroll", onScroll, scrollOpts);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return null;
}
