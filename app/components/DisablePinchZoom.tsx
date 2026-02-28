"use client";

import { useEffect } from "react";

export default function DisablePinchZoom() {
  useEffect(() => {
    const moveOpts: AddEventListenerOptions = { passive: false, capture: true };
    const touchOpts: AddEventListenerOptions = { passive: true, capture: true };
    let touchMoveAttached = false;

    const onTouchMove = (e: TouchEvent) => {
      if (!e.cancelable) return;
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const attachTouchMove = () => {
      if (touchMoveAttached) return;
      document.addEventListener("touchmove", onTouchMove, moveOpts);
      touchMoveAttached = true;
    };

    const detachTouchMove = () => {
      if (!touchMoveAttached) return;
      document.removeEventListener("touchmove", onTouchMove, moveOpts);
      touchMoveAttached = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        attachTouchMove();
      }
    };

    const onTouchEndOrCancel = (e: TouchEvent) => {
      if (!e.touches || e.touches.length < 2) {
        detachTouchMove();
      }
    };

    document.addEventListener("touchstart", onTouchStart, touchOpts);
    document.addEventListener("touchend", onTouchEndOrCancel, touchOpts);
    document.addEventListener("touchcancel", onTouchEndOrCancel, touchOpts);

    return () => {
      document.removeEventListener("touchstart", onTouchStart, touchOpts);
      document.removeEventListener("touchend", onTouchEndOrCancel, touchOpts);
      document.removeEventListener("touchcancel", onTouchEndOrCancel, touchOpts);
      detachTouchMove();
    };
  }, []);

  return null;
}
