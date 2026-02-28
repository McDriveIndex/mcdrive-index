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
    const getScrollTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop;
    const setScrollTop = (v: number) => {
      (document.scrollingElement ?? document.documentElement).scrollTop = v;
      window.scrollTo(0, v);
    };

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
      const y = getScrollTop();

      if (y > 0) {
        lastNonZeroY = y;
      }

      if (y === 0 && lastNonZeroY > 0) {
        setScrollTop(lastNonZeroY);
      } else if (lastNonZeroY > 120 && y < lastNonZeroY * 0.25) {
        setScrollTop(lastNonZeroY);
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
      const y = getScrollTop();
      if (y > 0) lastNonZeroY = y;
    };

    window.addEventListener("orientationchange", armAfterRotate);
    window.addEventListener("resize", armAfterRotate);
    window.addEventListener("scroll", onScroll, scrollOpts);

    return () => {
      stopAll();
      window.removeEventListener("orientationchange", armAfterRotate);
      window.removeEventListener("resize", armAfterRotate);
      window.removeEventListener("scroll", onScroll, scrollOpts);
    };
  }, []);

  return null;
}
