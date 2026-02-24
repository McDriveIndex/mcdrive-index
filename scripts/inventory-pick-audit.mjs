import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const btcHistoryPath = path.join(root, "data", "btc-history.json");
const inventoryDir = path.join(root, "data", "inventory");
const reportPath = path.join(root, "data", "reports", "pick-audit.json");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function printUsageAndExit(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/inventory-pick-audit.mjs [--last <N>] [--json]");
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    last: null,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--last") {
      if (i + 1 >= argv.length) printUsageAndExit("Missing value for --last");
      const raw = String(argv[i + 1] ?? "").trim();
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) printUsageAndExit("--last must be a positive integer");
      opts.last = n;
      i += 1;
      continue;
    }

    if (arg === "--json") {
      opts.json = true;
      continue;
    }

    printUsageAndExit(`Unknown flag: ${arg}`);
  }

  return opts;
}

function hashStringToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sortByPriceAsc(list) {
  return list.slice().sort((a, b) => a.price_usd - b.price_usd);
}

function pickIndexStyle(list, budgetUsd, seed) {
  const sorted = sortByPriceAsc(list);
  const affordable = sorted.filter((x) => x.price_usd <= budgetUsd);
  if (affordable.length === 0) return { best: null, alts: [], topCandidates: [] };

  const bandSize = clamp(Math.round(affordable.length * 0.1), 3, 8);
  const band = affordable.slice(Math.max(0, affordable.length - bandSize));

  const idx = hashStringToInt(seed) % band.length;
  const best = band[idx];
  const alts = band
    .filter((x) => x.id !== best.id)
    .slice()
    .sort((a, b) => b.price_usd - a.price_usd)
    .slice(0, 3);

  return { best, alts, topCandidates: band };
}

function pickPersonaDeterministic(seed) {
  const roll = hashStringToInt(seed) % 100;
  return roll < 60 ? "normie" : "enthusiast";
}

function normalizeInventoryList(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((x) => {
      if (!x || typeof x !== "object") return null;

      const id = typeof x.id === "string" && x.id.trim() ? x.id.trim() : null;
      if (!id) return null;

      let name = "";
      if (typeof x.name === "string" && x.name.trim()) {
        name = x.name.trim();
      } else if (
        typeof x.make === "string" &&
        x.make.trim() &&
        typeof x.model === "string" &&
        x.model.trim()
      ) {
        name = `${x.make.trim()} ${x.model.trim()}`;
      } else {
        name = id;
      }

      const price_usd = Number(x.price_usd ?? 0);
      const vibe = typeof x.vibe === "string" ? x.vibe : "";
      const copy = typeof x.copy === "string" ? x.copy : undefined;
      const tags = Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string") : undefined;
      const image = typeof x.image === "string" && x.image.trim() ? x.image : `/cars/${id}.jpg`;

      return {
        id,
        name,
        price_usd: Number.isFinite(price_usd) ? price_usd : 0,
        vibe,
        copy,
        tags,
        image,
      };
    })
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadInventories() {
  const tiers = {
    poverty: "poverty.json",
    "used-beaters": "used-beaters.json",
    "used-icons": "used-icons.json",
    "used-legends": "used-legends.json",
    "new-cars": "new-cars.json",
    exotics: "exotics.json",
  };

  const result = {};
  for (const [tier, filename] of Object.entries(tiers)) {
    const filePath = path.join(inventoryDir, filename);
    result[tier] = normalizeInventoryList(readJson(filePath));
  }
  return result;
}

function loadBtcHistory() {
  const parsed = readJson(btcHistoryPath);
  if (!Array.isArray(parsed)) throw new Error("BTC history root is not an array");

  return parsed
    .filter((row) => {
      return (
        row &&
        typeof row === "object" &&
        typeof row.date === "string" &&
        DATE_RE.test(row.date) &&
        typeof row.close === "number" &&
        Number.isFinite(row.close) &&
        row.close > 0
      );
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function categoryFromTier(tier) {
  return tier === "new-cars" || tier === "exotics" ? "new" : "used";
}

function matchCarsAudit(inventories, btcUsd, dateSeed) {
  const date = dateSeed ?? "no-date";
  const baseSeed = `${date}:${Math.floor(btcUsd)}`;

  if (btcUsd < 5000) {
    const { best, alts, topCandidates } = pickIndexStyle(inventories.poverty, btcUsd, `${baseSeed}:poverty`);
    return { tier: "poverty", bestMatch: best, alternatives: alts, topCandidates };
  }

  if (btcUsd < 10000) {
    const { best, alts, topCandidates } = pickIndexStyle(inventories["used-beaters"], btcUsd, `${baseSeed}:beater`);
    return { tier: "used-beaters", bestMatch: best, alternatives: alts, topCandidates };
  }

  if (btcUsd < 30000) {
    const { best, alts, topCandidates } = pickIndexStyle(inventories["used-icons"], btcUsd, `${baseSeed}:icons`);
    return { tier: "used-icons", bestMatch: best, alternatives: alts, topCandidates };
  }

  const persona = pickPersonaDeterministic(`${baseSeed}:persona`);
  let tier;
  let catalog;

  const EXOTICS_MIN = 150000;
  if (btcUsd >= EXOTICS_MIN) {
    const roll = hashStringToInt(`${baseSeed}:exotic-roll`) % 100;
    if (persona === "normie") {
      if (roll < 30) {
        tier = "exotics";
        catalog = inventories.exotics;
      } else {
        tier = "new-cars";
        catalog = inventories["new-cars"];
      }
    } else if (roll < 55) {
      tier = "exotics";
      catalog = inventories.exotics;
    } else {
      tier = "used-legends";
      catalog = inventories["used-legends"];
    }
  } else if (persona === "normie") {
    tier = "new-cars";
    catalog = inventories["new-cars"];
  } else {
    tier = "used-legends";
    catalog = inventories["used-legends"].length ? inventories["used-legends"] : inventories["used-icons"];
  }

  const { best, alts, topCandidates } = pickIndexStyle(catalog, btcUsd, `${baseSeed}:${tier}`);
  return { tier, bestMatch: best, alternatives: alts, topCandidates };
}

function bucketLabel(value, step = 10000) {
  const start = Math.floor(value / step) * step;
  const end = start + step - 1;
  return `${start}-${end}`;
}

function countTop(items, limit = 20) {
  return [...items.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}

function countBuckets(records, step = 10000) {
  const m = new Map();
  for (const r of records) {
    const label = bucketLabel(r.pickedPriceUsd, step);
    m.set(label, (m.get(label) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => {
    const aStart = Number(a[0].split("-")[0]);
    const bStart = Number(b[0].split("-")[0]);
    return aStart - bStart;
  }).map(([bucket, count]) => ({ bucket, count }));
}

function findMagnetStreaks(records, minStreak = 3) {
  if (records.length === 0) return [];
  const streaks = [];

  let startIdx = 0;
  for (let i = 1; i <= records.length; i += 1) {
    const prev = records[i - 1];
    const curr = records[i];
    const same = curr && curr.pickedId === prev.pickedId;

    if (same) continue;

    const len = i - startIdx;
    if (len >= minStreak) {
      const start = records[startIdx];
      const end = records[i - 1];
      streaks.push({
        id: start.pickedId,
        tier: start.tier,
        category: start.category,
        length: len,
        dateStart: start.date,
        dateEnd: end.date,
      });
    }
    startIdx = i;
  }

  return streaks.sort((a, b) => (b.length - a.length) || a.dateStart.localeCompare(b.dateStart));
}

function printSection(title) {
  console.log(`\n${title}`);
}

function printTableRows(rows, formatter) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  for (const row of rows) console.log(formatter(row));
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const inventories = loadInventories();
  let history = loadBtcHistory();

  if (opts.last) {
    history = history.slice(Math.max(0, history.length - opts.last));
  }

  const records = [];

  for (const row of history) {
    const match = matchCarsAudit(inventories, row.close, row.date);
    const best = match.bestMatch;
    if (!best) continue;

    records.push({
      date: row.date,
      btcUsd: row.close,
      category: categoryFromTier(match.tier),
      tier: match.tier,
      pickedId: best.id,
      pickedPriceUsd: best.price_usd,
      absDistanceUsd: Math.abs(best.price_usd - row.close),
      topCandidatesIds: match.topCandidates.map((c) => c.id),
    });
  }

  const overallCounts = new Map();
  const countsByCategory = { new: new Map(), used: new Map() };
  const recordsByCategory = { new: [], used: [] };
  const countsByTier = new Map();

  for (const r of records) {
    overallCounts.set(r.pickedId, (overallCounts.get(r.pickedId) ?? 0) + 1);
    countsByCategory[r.category].set(r.pickedId, (countsByCategory[r.category].get(r.pickedId) ?? 0) + 1);
    recordsByCategory[r.category].push(r);
    countsByTier.set(r.tier, (countsByTier.get(r.tier) ?? 0) + 1);
  }

  const avgDistance = records.length
    ? Math.round(records.reduce((sum, r) => sum + r.absDistanceUsd, 0) / records.length)
    : 0;

  console.log("Inventory Pick Audit");
  console.log(`Days simulated: ${records.length}`);
  console.log(`Date range: ${records[0]?.date ?? "N/A"} -> ${records[records.length - 1]?.date ?? "N/A"}`);
  console.log(`Average |price - btcUsd|: $${avgDistance.toLocaleString()}`);

  printSection("Tier Distribution");
  printTableRows(
    [...countsByTier.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).map(([tier, count]) => ({ tier, count })),
    (r) => `${r.tier.padEnd(13)} ${String(r.count).padStart(6)}`
  );

  printSection("Top 20 Picks (Overall)");
  printTableRows(countTop(overallCounts, 20), (r) => `${r.id.padEnd(20)} ${String(r.count).padStart(6)}`);

  printSection("Price Buckets (Overall, 10k)");
  printTableRows(countBuckets(records, 10000), (r) => `${r.bucket.padEnd(15)} ${String(r.count).padStart(6)}`);

  for (const category of ["used", "new"]) {
    printSection(`Top 20 Picks (${category})`);
    printTableRows(countTop(countsByCategory[category], 20), (r) => `${r.id.padEnd(20)} ${String(r.count).padStart(6)}`);

    printSection(`Price Buckets (${category}, 10k)`);
    printTableRows(countBuckets(recordsByCategory[category], 10000), (r) => `${r.bucket.padEnd(15)} ${String(r.count).padStart(6)}`);
  }

  const magnets = findMagnetStreaks(records, 3);
  printSection("Magnet Days (streak >= 3)");
  printTableRows(magnets.slice(0, 50), (r) => {
    return `${r.id.padEnd(20)} ${String(r.length).padStart(3)}d  ${r.dateStart} -> ${r.dateEnd}  [${r.category}/${r.tier}]`;
  });

  if (opts.json) {
    const report = {
      generatedAt: new Date().toISOString(),
      options: opts,
      summary: {
        daysSimulated: records.length,
        dateStart: records[0]?.date ?? null,
        dateEnd: records[records.length - 1]?.date ?? null,
        averageAbsDistanceUsd: avgDistance,
      },
      tierDistribution: [...countsByTier.entries()].map(([tier, count]) => ({ tier, count })),
      topOverall: countTop(overallCounts, 20),
      priceBucketsOverall: countBuckets(records, 10000),
      topUsed: countTop(countsByCategory.used, 20),
      topNew: countTop(countsByCategory.new, 20),
      priceBucketsUsed: countBuckets(recordsByCategory.used, 10000),
      priceBucketsNew: countBuckets(recordsByCategory.new, 10000),
      magnetStreaks: magnets,
      daily: records,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\nSaved JSON report: ${reportPath}`);
  }
}

try {
  run();
} catch (error) {
  console.error("[inventory:audit-picks] failed", error instanceof Error ? error.message : error);
  process.exit(1);
}
