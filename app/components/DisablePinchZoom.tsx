"use client";

import { useEffect } from "react";

export default function DisablePinchZoom() {
  useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false, capture: true };

    const onGesture = (e: Event) => {
      if (!("cancelable" in e) || !(e as Event).cancelable) return;
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.cancelable) return;
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("gesturestart" as any, onGesture, opts);
    document.addEventListener("gesturechange" as any, onGesture, opts);
    document.addEventListener("gestureend" as any, onGesture, opts);
    document.addEventListener("touchmove", onTouchMove, opts);

    return () => {
      document.removeEventListener("gesturestart" as any, onGesture, opts);
      document.removeEventListener("gesturechange" as any, onGesture, opts);
      document.removeEventListener("gestureend" as any, onGesture, opts);
      document.removeEventListener("touchmove", onTouchMove, opts);
    };
  }, []);

  return null;
}
