"use client";

import { useEffect } from "react";

export default function DisablePinchZoom() {
  useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false, capture: true };
    let touchMoveAttached = false;

    const onTouchMove = (e: TouchEvent) => {
      if (!e.cancelable) return;
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const attachTouchMove = () => {
      if (touchMoveAttached) return;
      document.addEventListener("touchmove", onTouchMove, opts);
      touchMoveAttached = true;
    };

    const detachTouchMove = () => {
      if (!touchMoveAttached) return;
      document.removeEventListener("touchmove", onTouchMove, opts);
      touchMoveAttached = false;
    };

    const onGesture = (e: Event) => {
      if (!("cancelable" in e) || !(e as Event).cancelable) return;
      e.preventDefault();

      const type = (e as Event).type;
      if (type === "gesturestart" || type === "gesturechange") {
        attachTouchMove();
      } else if (type === "gestureend") {
        detachTouchMove();
      }
    };

    document.addEventListener("gesturestart" as any, onGesture, opts);
    document.addEventListener("gesturechange" as any, onGesture, opts);
    document.addEventListener("gestureend" as any, onGesture, opts);

    return () => {
      document.removeEventListener("gesturestart" as any, onGesture, opts);
      document.removeEventListener("gesturechange" as any, onGesture, opts);
      document.removeEventListener("gestureend" as any, onGesture, opts);
      detachTouchMove();
    };
  }, []);

  return null;
}
