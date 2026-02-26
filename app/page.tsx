"use client";

import { useEffect, useState } from "react";
import { matchCars, type MatchResult } from "@/lib/matchCar";
import AnimatedBorder from "@/app/components/AnimatedBorder";
import HeroHeadline from "@/app/components/HeroHeadline";
import MenuCard from "@/app/components/MenuCard";
import styles from "./page.module.css";

type Car = {
  id: string;
  name: string;
  price_usd: number;
  vibe: string;
  copy?: string;
  tags?: string[];
  image?: string;
};

type BtcPriceResponse = {
  dateRequested: string;
  dateUsed: string;
  close: number;
  clamped?: boolean;
};

type BtcRangeResponse = {
  minDate: string;
  maxDate: string;
};

type LoadForDateResult = {
  ok: boolean;
  data: BtcPriceResponse | null;
  match: MatchResult | null;
};

function isBtcPriceResponse(value: unknown): value is BtcPriceResponse {
  if (!value || typeof value !== "object") return false;
  const maybe = value as any;
  const baseOk =
    typeof maybe.dateRequested === "string" &&
    typeof maybe.dateUsed === "string" &&
    typeof maybe.close === "number";
  if (!baseOk) return false;
  if ("clamped" in maybe && typeof maybe.clamped !== "boolean") return false;
  return true;
}

function isBtcRangeResponse(value: unknown): value is BtcRangeResponse {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<BtcRangeResponse>;
  return typeof maybe.minDate === "string" && typeof maybe.maxDate === "string";
}

function formatDisplayDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .replaceAll("/", "-");
}

function formatUsdDisplay(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

const TIER_COPY: Record<string, string> = {
  "poverty": "FULL SEND REGRET",
  "used-beaters": "BEATED BY A BEATER",
  "used-icons": "AGED LIKE FINE WINE",
  "used-legends": "SMILES PER GALLON",
  "new-cars": "TAX WRITE-OFF",
  "exotics": "KOL DAILY DRIVER",
};

export default function Home() {
  const [date, setDate] = useState("");
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [bestMatch, setBestMatch] = useState<Car | null>(null);
  const [alternatives, setAlternatives] = useState<Car[]>([]);
  const [tier, setTier] = useState<string | null>(null);
  const [dateUsed, setDateUsed] = useState<string | null>(null);
  const [wasClamped, setWasClamped] = useState(false);
  const [btcRange, setBtcRange] = useState<BtcRangeResponse | null>(null);
  const [frameW, setFrameW] = useState<number | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [receiptSrc, setReceiptSrc] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const receiptBestMatch = bestMatch;
  const receiptBtc = btcPrice;

  const loadForDate = async (d: string): Promise<LoadForDateResult> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/btc-price?date=${d}`);
      const payload: unknown = await res.json();

      if (!res.ok) {
        const errorMessage =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Something went wrong";
        alert(errorMessage);
        return { ok: false, data: null, match: null };
      }

      if (!isBtcPriceResponse(payload)) {
        alert("Invalid BTC API response");
        return { ok: false, data: null, match: null };
      }

      const data = payload;
      const match = matchCars(data.close, d);
      setBtcPrice(data.close);
      setDateUsed(data.dateUsed);
      setWasClamped(Boolean(data.clamped));
      setBestMatch((match.bestMatch as Car | null) ?? null);
      setAlternatives((match.alternatives as Car[]) || []);
      setTier(match.tier);
      return { ok: true, data, match };
    } catch {
      alert("Something went wrong");
      return { ok: false, data: null, match: null };
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (!date) {
      alert("Pick a date first.");
      return;
    }

    setIsGenerating(true);
    setShowReceipt(false);
    setShowModal(false);

    // Update URL (shareable)
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.pushState({}, "", url.toString());

    try {
      const result = await loadForDate(date);
      const ok = result.ok;
      const data = result.data;
      const match = result.match;
      await new Promise((r) => setTimeout(r, 0));

      if (ok && data && match) {
        const btcUsd = data.close;
        const best = (match.bestMatch as Car | null) ?? null;
        const loadedTier = match.tier;
        const extraCopy = best?.copy ?? "";
        const tierCopy = loadedTier ? (TIER_COPY[loadedTier] ?? "—") : "—";
        const price = best ? `$${best.price_usd.toLocaleString()}` : "—";
        const btc = btcUsd != null ? String(btcUsd) : "—";
        const changeValue = best ? Math.max(0, btcUsd - best.price_usd) : null;
        const change = changeValue == null ? "—" : `$${formatUsdDisplay(changeValue)}`;
        const image = best?.image ?? "/cars/placeholder.jpg";
        const name = best?.name ?? "—";
        const params = new URLSearchParams({
          date,
          dateUsed: data.dateUsed,
          btc,
          name,
          price,
          change,
          tierCopy,
          extraCopy,
          image,
          v: String(Date.now()),
        });
        const newReceiptUrl = `/api/receipt?${params.toString()}`;
        setReceiptUrl(newReceiptUrl);
        setReceiptSrc(newReceiptUrl);
      } else {
        setReceiptUrl(null);
        setReceiptSrc("");
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      if (ok && match?.bestMatch) setShowModal(true);
      else setShowModal(false);
      setShowReceipt(ok);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = async () => {
    const url = new URL(window.location.href);
    if (date) url.searchParams.set("date", date);

    try {
      await navigator.clipboard.writeText(url.toString());
      setToast("Copied link to clipboard 🍟");
      setTimeout(() => setToast(null), 1500);
    } catch {
      alert("Couldn’t copy automatically. Copy from the address bar.");
    }
  };

  // Auto-load if opened with ?date=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d) {
      setDate(d);
      loadForDate(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/btc-range", { cache: "no-store" });
        const payload: unknown = await res.json();
        if (!res.ok || !isBtcRangeResponse(payload) || !active) return;
        setBtcRange(payload);
      } catch {
        // keep UI usable even if range endpoint fails
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const todayMax = new Date().toISOString().slice(0, 10);
  const pickerMin = btcRange?.minDate;
  const pickerMax = btcRange?.maxDate ?? todayMax;
  function randomDateIn2017() {
  const start = new Date("2017-01-01T00:00:00Z").getTime();
  const end = new Date("2017-12-31T00:00:00Z").getTime();
  const t = start + Math.floor(Math.random() * (end - start + 1));
  return new Date(t).toISOString().slice(0, 10);
}

const runMoment = async (momentDate: string) => {
  const d = momentDate === "random" ? randomDateIn2017() : momentDate;
  setDate(d);

  const url = new URL(window.location.href);
  url.searchParams.set("date", d);
  window.history.pushState({}, "", url.toString());

  setIsGenerating(true);
  setShowModal(false);
  setReceiptSrc("");

  const result = await loadForDate(d);
  const ok = result.ok;
  const data = result.data;
  const match = result.match;
  await new Promise((r) => setTimeout(r, 0));
  if (ok && data && match) {
    const btcUsd = data.close;
    const best = (match.bestMatch as Car | null) ?? null;
    const loadedTier = match.tier;
    const extraCopy = best?.copy ?? "";
    const tierCopy = loadedTier ? (TIER_COPY[loadedTier] ?? "—") : "—";
    const price = best ? `$${best.price_usd.toLocaleString()}` : "—";
    const btc = btcUsd != null ? String(btcUsd) : "—";
    const changeValue = best ? Math.max(0, btcUsd - best.price_usd) : null;
    const change = changeValue == null ? "—" : `$${formatUsdDisplay(changeValue)}`;
    const image = best?.image ?? "/cars/placeholder.jpg";
    const name = best?.name ?? "—";

    const params = new URLSearchParams({
      date: d,
      dateUsed: data.dateUsed,
      btc,
      name,
      price,
      change,
      tierCopy,
      extraCopy,
      image,
      v: String(Date.now()),
    });

    const newReceiptUrl = `/api/receipt?${params.toString()}`;
    setReceiptUrl(newReceiptUrl);
    setReceiptSrc(newReceiptUrl);
  } else {
    setReceiptUrl(null);
    setReceiptSrc("");
  }

  await new Promise((r) => setTimeout(r, 800));

  if (ok && match?.bestMatch) {
    setShowModal(true);
  } else {
    setShowModal(false);
  }

  setIsGenerating(false);
};


  return (
    <main className="h-screen min-h-[100svh] paper-bg text-black antialiased overflow-hidden">
      <AnimatedBorder />
      <div
        className="h-[100svh] max-w-full overflow-hidden flex flex-col items-center justify-start px-[clamp(16px,3vw,28px)] pt-[clamp(44px,6.5vh,96px)] gap-[clamp(10px,2.2vh,22px)]"
        style={frameW ? ({ ["--headline-frame-w" as any]: `${frameW}px` } as any) : undefined}
      >
        <HeroHeadline onFrameWidth={setFrameW} />
        <div className="mt-[clamp(-6px,-1vh,-16px)] w-full flex justify-center">
          <MenuCard
            date={date}
            minDate={pickerMin}
            maxDate={pickerMax}
            onDateChange={(value) => {
              setDate(value);
              setBtcPrice(null);
              setDateUsed(null);
              setWasClamped(false);
              setBestMatch(null);
              setAlternatives([]);
              setTier(null);
              setReceiptUrl(null);
              setShowReceipt(false);
              setIsGenerating(false);
              setToast(null);
              setReceiptSrc("");
              setShowModal(false);
            }}
            onOrder={handleClick}
            meals={[
              { label: "McLehman Double Smash", onClick: () => runMoment("2008-09-15") },
              { label: "McCovid Flash Crash", onClick: () => runMoment("2020-03-12") },
              { label: "McATH Supersize", onClick: () => runMoment("2021-11-10") },
              { label: "McRandom Ride™", onClick: () => runMoment("random") },
            ]}
            busyLabel={isGenerating || loading ? "Preparing your order..." : null}
            infoLine={
              wasClamped && dateUsed
                ? `Selected date out of range. Clamped to ${formatDisplayDate(dateUsed)}.`
                : dateUsed && date && dateUsed !== date
                  ? `Using last available close: ${formatDisplayDate(dateUsed)}`
                  : toast
                    ? toast
                    : null
            }
          />
        </div>
        <div className={styles.homeFooter}>
          © 2026 McDrive Index™ - POWERED BY
        </div>
      </div>

      {/* Receipt-ish Result */}
      {false && (btcPrice || bestMatch || alternatives.length > 0) && (
        <div className="w-full max-w-md">
          <div className="bg-white text-black rounded-2xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500">MC DRIVE-THRU RECEIPT</p>
                <p className="font-extrabold tracking-tight text-xl">
                  1 BTC ORDER
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">DATE</p>
                <p className="font-semibold">{date || "—"}</p>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-4" />

            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">BTC price (USD)</span>
              <span className="font-semibold">
                {receiptBtc != null
                  ? `$${receiptBtc!.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "—"}
              </span>
            </div>

            <div className="border-t border-dashed border-gray-300 my-4" />

            {receiptBestMatch ? (
  <>
    <p className="text-xs text-gray-500 mb-1">YOU CAN DRIVE</p>

    <img
  src={receiptBestMatch!.image ?? "/cars/placeholder.jpg"}
  alt={receiptBestMatch!.name}
  onError={(e) => {
    const img = e.currentTarget;
    if (!img.dataset.fallback) {
      img.dataset.fallback = "1";
      img.src = "/cars/placeholder.jpg";
    }
  }}
  className="w-full rounded-xl mb-3"
/>



    <p className="text-2xl font-extrabold mb-1">
      {receiptBestMatch!.name}
    </p>

    <p className="text-gray-700 mb-2">
      ${receiptBestMatch!.price_usd.toLocaleString()} •{" "}
      <span className="italic">{receiptBestMatch!.vibe}</span>
    </p>

    {receiptBestMatch!.copy && (
      <p className="text-sm text-gray-600 mt-2">
        {receiptBestMatch!.copy}
      </p>
    )}
  </>
) : (
  <p className="font-semibold">
    Not even a scooter. Try a different date.
  </p>
)}


            {alternatives.length > 0 && (
              <>
                <div className="border-t border-dashed border-gray-300 my-4" />
                <p className="text-xs text-gray-500 mb-2">ALSO COULD HAVE DRIVEN</p>

                <div className="space-y-2">
                  {alternatives.map((car) => (
                    <div key={car.id} className="flex justify-between text-sm">
                      <span className="font-semibold">
                        {car.name}
                      </span>
                      <span className="text-gray-700">
                        ${car.price_usd.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-dashed border-gray-300 my-4" />

            <p className="text-xs text-gray-500">
              Tip: share the link. Blame the blockchain.
            </p>
          </div>

          <p className="text-gray-500 text-xs text-center mt-4">
            Prices are approximate. Vibes are non-refundable.
          </p>
        </div>
      )}

      {showModal && receiptSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onClick={() => {
            setShowModal(false);
            setReceiptSrc("");
          }}
        >
          <div
            className="grain-drift pointer-events-none fixed inset-0 z-0 opacity-[0.05] [background-image:url('/paper-grain.png')] [background-size:900px_900px] [animation:grain-drift_14s_linear_infinite]"
          />
          <div className="thermal-scan pointer-events-none fixed inset-0 z-0" />

          <div
            className="relative z-10 w-full max-w-md flex flex-col items-center opacity-0 translate-y-2 [animation:modalIn_200ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full mb-2 flex items-center justify-between">
              <div />
              <button
                onClick={() => {
                  setShowModal(false);
                  setReceiptSrc("");
                  setShowReceipt(false);
                }}
                className="text-xs uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 rounded-sm px-1"
              >
                × Close
              </button>
            </div>

            <div className="relative w-full before:content-[''] before:absolute before:inset-[-24px] before:rounded-[24px] before:bg-black/10 before:blur-2xl before:opacity-20 before:-z-10">
              <img
                src={receiptSrc}
                alt="McDrive receipt PNG"
                className="w-full shadow-[0_18px_30px_rgba(0,0,0,0.12)]"
              />
            </div>

            <div className="mt-10 w-full flex gap-3 justify-center">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(receiptSrc);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `mcdrive-receipt-${date || "date"}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(receiptSrc, "_blank");
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition"
              >
                Download
              </button>

              <button
                onClick={() => {
                  const bm = bestMatch;
                  const carName = bm?.name ?? "something questionable";
                  const shareUrl = new URL(window.location.href);
                  if (date) shareUrl.searchParams.set("date", date);

                  const displayDate = date ? formatDisplayDate(date) : "—";
                  const text = `McDrive Index™ — ${displayDate}\n1 BTC → ${carName}`;
                  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                  window.open(intent, "_blank", "noopener,noreferrer");
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-black/20 bg-white text-black font-semibold hover:bg-black/[0.03] transition"
              >
                Post on X
              </button>
            </div>

            <p className="mt-3 text-sm text-black/70">
              Download the receipt → attach it to your post.
            </p>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(0.5rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
