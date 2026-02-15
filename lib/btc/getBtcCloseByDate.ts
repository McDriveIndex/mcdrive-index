import { readFile } from "node:fs/promises";
import path from "node:path";

type BtcHistoryRow = {
  date: string;
  close: number;
};

let historyCache: BtcHistoryRow[] | null = null;
let historyLoadPromise: Promise<BtcHistoryRow[] | null> | null = null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function loadHistory(): Promise<BtcHistoryRow[] | null> {
  if (historyCache) return historyCache;
  if (historyLoadPromise) return historyLoadPromise;

  historyLoadPromise = (async () => {
    const filePath = path.join(process.cwd(), "data", "btc-history.json");

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.error("Failed to read BTC history: JSON root is not an array");
        return null;
      }

      const rows = parsed
        .filter((item): item is BtcHistoryRow => {
          if (!item || typeof item !== "object") return false;
          const maybe = item as Partial<BtcHistoryRow>;
          return (
            typeof maybe.date === "string" &&
            DATE_RE.test(maybe.date) &&
            typeof maybe.close === "number" &&
            Number.isFinite(maybe.close) &&
            maybe.close > 0
          );
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (rows.length === 0) {
        console.error("Failed to read BTC history: no valid rows in dataset");
        return null;
      }

      historyCache = rows;
      return rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read BTC history: ${message}`);
      return null;
    } finally {
      historyLoadPromise = null;
    }
  })();

  return historyLoadPromise;
}

export async function getBtcCloseByDate(
  dateISO: string
): Promise<{ dateUsed: string; close: number } | null> {
  if (!DATE_RE.test(dateISO)) return null;

  const rows = await loadHistory();
  if (!rows || rows.length === 0) return null;

  const idx = findRightmostDateLE(rows, dateISO);
  if (idx < 0) return null;

  const row = rows[idx];
  return { dateUsed: row.date, close: row.close };
}

function findRightmostDateLE(rows: BtcHistoryRow[], targetDate: string): number {
  let left = 0;
  let right = rows.length - 1;
  let answer = -1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    const midDate = rows[mid].date;

    if (midDate <= targetDate) {
      answer = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return answer;
}
