import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const INPUT = path.join(process.cwd(), "data", "raw", "coin_Bitcoin.csv");
const OUTPUT = path.join(process.cwd(), "data", "btc_daily_close_usd.json");

if (!fs.existsSync(INPUT)) {
  console.error(`Missing input CSV at: ${INPUT}`);
  process.exit(1);
}

const rl = readline.createInterface({
  input: fs.createReadStream(INPUT),
  crlfDelay: Infinity,
});

let header = null;
let idxDate = -1;
let idxClose = -1;

const out = {}; // { "YYYY-MM-DD": closeUsd }

for await (const line of rl) {
  if (!line.trim()) continue;

  // Header row
  if (!header) {
    header = line.split(",");
    idxDate = header.indexOf("Date");
    idxClose = header.indexOf("Close");

    if (idxDate === -1 || idxClose === -1) {
      console.error(
        `CSV header must include Date and Close columns. Found: ${header.join(", ")}`
      );
      process.exit(1);
    }
    continue;
  }

  // Kaggle file is simple CSV, split is fine
  const parts = line.split(",");
  const date = parts[idxDate];
  const closeStr = parts[idxClose];

  if (!date || !closeStr) continue;

  const close = Number(closeStr);
  if (Number.isFinite(close)) {
    out[date] = close;
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), "utf-8");

const dates = Object.keys(out).sort();
console.log(`✅ Wrote ${dates.length} days to ${OUTPUT}`);
console.log(`📅 Range: ${dates[0]} → ${dates[dates.length - 1]}`);
