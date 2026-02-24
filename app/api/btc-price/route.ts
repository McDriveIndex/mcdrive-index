import { NextRequest, NextResponse } from "next/server";
import { getBtcCloseByDate } from "@/lib/btc/getBtcCloseByDate";
import { getBtcDateRange } from "@/lib/btc/getBtcDateRange";

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

  const range = await getBtcDateRange();
  if (!range) {
    return NextResponse.json(
      { error: "BTC history dataset unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  let dateEffective = date;
  let clamped = false;
  if (date < range.minDate) {
    dateEffective = range.minDate;
    clamped = true;
  } else if (date > range.maxDate) {
    dateEffective = range.maxDate;
    clamped = true;
  }

  const result = await getBtcCloseByDate(dateEffective);
  if (!result) {
    return NextResponse.json(
      { error: "No BTC data available for that date" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      dateRequested: date,
      dateUsed: result.dateUsed,
      close: result.close,
      clamped,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
