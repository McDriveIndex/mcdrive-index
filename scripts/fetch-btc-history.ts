import { mkdir, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const SOURCE_URL = "https://stooq.com/q/d/l/?s=btcusd&i=d";
const OUTPUT_DIR = path.join(process.cwd(), "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "btc-history.json");

type HistoryRow = {
  date: string;
  close: number;
};

const REQUEST_HEADERS = {
  "User-Agent": "mcdrive-index-bot/1.0 (+https://github.com/McDriveIndex/mcdrive-index)",
  "Accept": "text/csv,*/*;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

const RETRY_DELAYS_MS = [2000, 4000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextOnce(
  url: string
): Promise<{ status: number; body: string; contentType: string | null }> {
  if (typeof fetch === "function") {
    let response: Response;
    try {
      response = await fetch(url, { headers: REQUEST_HEADERS });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error while fetching CSV: ${message}`);
    }

    const body = await response.text();
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      throw new Error(
        `HTTP error while fetching CSV: ${response.status} ${response.statusText}. First 200 chars: ${body.slice(0, 200)}`
      );
    }

    return { status: response.status, body, contentType };
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      new URL(url),
      {
        headers: REQUEST_HEADERS,
      },
      (res) => {
      const status = res.statusCode ?? 0;
      const contentType =
        typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `HTTP error while fetching CSV: ${status}. First 200 chars: ${body.slice(0, 200)}`
              )
            );
            return;
          }

          resolve({ status, body, contentType });
        });
      }
    );

    req.on("error", (err) => {
      reject(new Error(`Network error while fetching CSV: ${err.message}`));
    });
  });
}

async function fetchText(
  url: string
): Promise<{ status: number; body: string; contentType: string | null }> {
  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchTextOnce(url);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to fetch CSV after ${maxAttempts} attempts: ${message}`);
}

function parseHistory(csvText: string): HistoryRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    throw new Error("CSV is empty");
  }

  const rawHeader = nonEmptyLines[0].replace(/^\uFEFF/, "").trim();
  const headerColumns = rawHeader.split(",").map((col) => col.trim());
  const dateIdx = headerColumns.findIndex((col) => col.toLowerCase() === "date");
  const closeIdx = headerColumns.findIndex((col) => col.toLowerCase() === "close");

  if (dateIdx === -1 || closeIdx === -1) {
    const preview = nonEmptyLines
      .slice(0, 3)
      .map((line, idx) => `${idx + 1}) ${line}`)
      .join("\n");
    throw new Error(`Unexpected CSV header: "${rawHeader}"\nPreview:\n${preview}`);
  }

  const rows: HistoryRow[] = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const line of nonEmptyLines.slice(1)) {
    const parts = line.split(",");
    if (parts.length <= Math.max(dateIdx, closeIdx)) continue;

    const date = parts[dateIdx]?.trim();
    const closeRaw = parts[closeIdx]?.trim();
    if (!date || !closeRaw) continue;
    if (!dateRegex.test(date)) continue;

    const close = Number.parseFloat(closeRaw);
    if (!Number.isFinite(close) || close <= 0) continue;

    rows.push({ date, close });
  }

  if (rows.length === 0) {
    throw new Error("CSV has no valid data rows");
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export async function fetchBtcHistory(): Promise<void> {
  const { status, body, contentType } = await fetchText(SOURCE_URL);
  const first500 = body.slice(0, 500);
  const first200 = body.slice(0, 200);
  if (/<html|<!doctype/i.test(first500)) {
    console.error(
      `Non-CSV response detected. status=${status} content-type=${contentType ?? "unknown"} first200=${first200}`
    );
    throw new Error(
      `Response is HTML, not CSV. status=${status} content-type=${contentType ?? "unknown"} first200=${first200}`
    );
  }

  const firstNonEmpty = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstNonEmpty || !firstNonEmpty.includes(",")) {
    console.error(
      `Non-CSV response detected. status=${status} content-type=${contentType ?? "unknown"} first200=${first200}`
    );
    throw new Error(
      `Response is not CSV. status=${status} content-type=${contentType ?? "unknown"} first200=${first200}`
    );
  }

  const rows = parseHistory(body);
  const minDate = rows[0]?.date ?? "n/a";
  const maxDate = rows[rows.length - 1]?.date ?? "n/a";

  const maxDateUtc = new Date(`${maxDate}T00:00:00Z`);
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const diffDays = Math.floor(
    (todayUtc.getTime() - maxDateUtc.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > 3) {
    throw new Error(
      `BTC dataset is stale. Latest date is ${maxDate} (more than 3 days behind today).`
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(rows, null, 2), "utf8");

  console.log(`Saved ${rows.length} rows to ${OUTPUT_FILE}`);
  console.log(`Date range: ${minDate} -> ${maxDate}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  fetchBtcHistory().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch BTC history: ${message}`);
    process.exit(1);
  });
}
