import { NextResponse } from "next/server";
import { getBtcDateRange } from "@/lib/btc/getBtcDateRange";

export async function GET() {
  const range = await getBtcDateRange();
  if (!range) {
    return NextResponse.json(
      { error: "BTC history dataset unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(range, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
