"use client";

import { useEffect } from "react";

export default function DisablePinchZoom() {
  useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false };

    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener("gesturestart" as any, onGesture, opts);
    window.addEventListener("gesturechange" as any, onGesture, opts);
    window.addEventListener("gestureend" as any, onGesture, opts);
    window.addEventListener("touchmove", onTouchMove, opts);

    return () => {
      window.removeEventListener("gesturestart" as any, onGesture, opts);
      window.removeEventListener("gesturechange" as any, onGesture, opts);
      window.removeEventListener("gestureend" as any, onGesture, opts);
      window.removeEventListener("touchmove", onTouchMove, opts);
    };
  }, []);

  return null;
}
