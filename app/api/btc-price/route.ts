import { NextRequest, NextResponse } from "next/server";
import { matchCars } from "@/lib/matchCar";

type CacheEntry = { btc_usd: number; expiresAt: number };

// cache in memoria (vale finché il server dev è acceso)
const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60; // 1 ora

function toDDMMYYYY(yyyyMmDd: string) {
  // input: "2026-02-10" -> output: "10-02-2026"
  const [yyyy, mm, dd] = yyyyMmDd.split("-");
  if (!yyyy || !mm || !dd) return null;
  return `${dd}-${mm}-${yyyy}`;
}

function isFutureDateUTC(yyyyMmDd: string) {
  const requested = new Date(`${yyyyMmDd}T00:00:00Z`);
  if (Number.isNaN(requested.getTime())) return false;

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  return requested > todayUtc;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // Blocca date future (CoinGecko history è "storico")
  if (isFutureDateUTC(date)) {
    return NextResponse.json(
      { error: "Date is in the future. Pick a past date." },
      { status: 400 }
    );
  }

  const ddmmyyyy = toDDMMYYYY(date);
  if (!ddmmyyyy) {
    return NextResponse.json({ error: "invalid date format" }, { status: 400 });
  }

  // Cache
  const nowMs = Date.now();
  const cached = cache.get(date);
  if (cached && cached.expiresAt > nowMs) {
    return NextResponse.json({ date, btc_usd: cached.btc_usd, source: "cache" });
  }

  const apiKey = process.env.COINGECKO_DEMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing COINGECKO_DEMO_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${ddmmyyyy}`;

    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": apiKey,
      },
    });

    if (!res.ok) {
      // utile per debug: includiamo anche lo status text
      return NextResponse.json(
        { error: `upstream error from CoinGecko (${res.status})` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const btc_usd = json?.market_data?.current_price?.usd;

    if (typeof btc_usd !== "number") {
      return NextResponse.json(
        { error: "CoinGecko returned no USD price for that date" },
        { status: 502 }
      );
    }

    cache.set(date, { btc_usd, expiresAt: nowMs + TTL_MS });

    const { tier, bestMatch, alternatives } = matchCars(btc_usd, date);


return NextResponse.json({
  date,
  btc_usd,
  source: "coingecko",
  tier,
  bestMatch,
  alternatives,
});
  } catch {
    return NextResponse.json({ error: "failed to fetch BTC price" }, { status: 500 });
  }
}
