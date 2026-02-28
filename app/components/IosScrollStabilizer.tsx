"use client";

import { useEffect } from "react";

export default function IosScrollStabilizer() {
  useEffect(() => {
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {
      // no-op
    }

    let rafId = 0;
    let stopRequested = false;

    const stopLoop = () => {
      stopRequested = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const startStabilize = () => {
      stopLoop();
      const savedY = window.scrollY;
      if (savedY <= 0) return;

      stopRequested = false;
      const startedAt = performance.now();
      let frames = 0;
      let stableFrames = 0;
      let lastY = window.scrollY;

      const tick = () => {
        if (stopRequested) return;
        frames += 1;

        const now = performance.now();
        const y = window.scrollY;

        if (y === 0 && savedY > 0) {
          window.scrollTo(0, savedY);
        }

        const currentY = window.scrollY;
        if (Math.abs(currentY - lastY) < 1) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastY = currentY;

        if (now - startedAt > 600 || frames >= 20 || stableFrames >= 3) {
          stopLoop();
          return;
        }

        rafId = window.requestAnimationFrame(tick);
      };

      rafId = window.requestAnimationFrame(tick);
    };

    const onTouchStart = () => {
      stopLoop();
    };

    window.addEventListener("orientationchange", startStabilize);
    window.addEventListener("resize", startStabilize);
    window.addEventListener("touchstart", onTouchStart, { passive: true });

    return () => {
      stopLoop();
      window.removeEventListener("orientationchange", startStabilize);
      window.removeEventListener("resize", startStabilize);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return null;
}
