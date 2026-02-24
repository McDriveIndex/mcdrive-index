import { getBtcHistoryRows } from "./getBtcCloseByDate";

export async function getBtcDateRange(): Promise<{
  minDate: string;
  maxDate: string;
} | null> {
  const rows = await getBtcHistoryRows();
  if (!rows || rows.length === 0) return null;

  return {
    minDate: rows[0].date,
    maxDate: rows[rows.length - 1].date,
  };
}
