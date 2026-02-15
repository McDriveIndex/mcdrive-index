import { NextRequest, NextResponse } from "next/server";
import { getBtcCloseByDate } from "@/lib/btc/getBtcCloseByDate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Invalid or missing date. Use ?date=YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const result = await getBtcCloseByDate(date);
  if (!result) {
    return NextResponse.json(
      { error: "No BTC data available for that date" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      dateRequested: date,
      dateUsed: result.dateUsed,
      close: result.close,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
