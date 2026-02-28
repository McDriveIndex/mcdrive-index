const inFlight = new Map<string, Promise<void>>();
const done = new Set<string>();

function loadViaImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    // Ensure we resolve only once (decode + onload race-safe)
    const resolveOnce = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    try {
      (img as HTMLImageElement & { decoding?: "sync" | "async" | "auto" }).decoding = "async";
    } catch {
      // noop
    }

    img.onload = () => resolveOnce(true);
    img.onerror = () => resolveOnce(false);
    img.src = url;

    const decodeFn = typeof img.decode === "function" ? img.decode.bind(img) : null;
    if (decodeFn) {
      void decodeFn().then(() => resolveOnce(true)).catch(() => {
        // keep waiting for onload/onerror
      });
    }
  });
}

export function warmReceipt(url: string): Promise<void> {
  if (!url) return Promise.resolve();
  if (done.has(url)) return Promise.resolve();

  const existing = inFlight.get(url);
  if (existing) return existing;

  const p = loadViaImage(url)
    .then((ok) => {
      if (ok) done.add(url);
    })
    .catch(() => {
      // fail-open: warming must never break UI
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, p);
  return p;
}

export function scheduleWarmReceiptIdle(url: string): void {
  if (!url) return;
  const ric = (globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void) => number;
  }).requestIdleCallback;

  // Use idle time when available to avoid impacting main thread
  if (typeof ric === "function") {
    ric(() => {
      void warmReceipt(url);
    });
    return;
  }

  setTimeout(() => {
    void warmReceipt(url);
  }, 300);
}
