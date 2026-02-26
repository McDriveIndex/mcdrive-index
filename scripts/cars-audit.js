const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const inventoryDir = path.join(root, "data", "inventory");
const reportPath = path.join(inventoryDir, "_audit.json");

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findPrice(entry) {
  if (!entry || typeof entry !== "object") return { key: null, value: null };
  const candidates = ["price_usd", "price", "usd"];
  for (const key of candidates) {
    const raw = entry[key];
    const value = Number(raw);
    if (Number.isFinite(value)) return { key, value };
  }
  return { key: null, value: null };
}

function toTierEntries(filePath) {
  const fileName = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${fileName}: expected JSON array`);
  }

  const entries = [];
  const issues = [];

  for (let i = 0; i < parsed.length; i += 1) {
    const item = parsed[i];
    if (!item || typeof item !== "object") {
      issues.push({ index: i, issue: "entry_not_object" });
      continue;
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : typeof item.make === "string" && typeof item.model === "string"
          ? `${item.make} ${item.model}`.trim()
          : "";

    const { key: priceKey, value: price } = findPrice(item);

    if (!id) issues.push({ index: i, issue: "missing_id" });
    if (!priceKey || price == null) issues.push({ index: i, issue: "missing_price" });

    entries.push({
      id,
      name,
      price,
      priceKey,
      raw: item,
      fileName,
      index: i,
    });
  }

  return { entries, issues };
}

function listTierFiles(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Missing inventory dir: ${dir}`);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json") && d.name !== "_audit.json")
    .map((d) => path.join(dir, d.name))
    .sort((a, b) => a.localeCompare(b));
}

function pushMapList(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function toObjectOnlyDuplicates(map) {
  const out = {};
  for (const [key, arr] of map.entries()) {
    if (arr.length > 1) out[key] = arr;
  }
  return out;
}

function run() {
  const tierFiles = listTierFiles(inventoryDir);

  const duplicatesByIdMap = new Map();
  const duplicatesByNameMap = new Map();
  const tierStats = {};
  const parseIssues = {};

  for (const filePath of tierFiles) {
    const tierFile = path.basename(filePath);
    const { entries, issues } = toTierEntries(filePath);
    if (issues.length) parseIssues[tierFile] = issues;

    const validPrices = entries
      .map((e) => e.price)
      .filter((v) => typeof v === "number" && Number.isFinite(v));

    tierStats[tierFile] = {
      count: entries.length,
      minPrice: validPrices.length ? Math.min(...validPrices) : null,
      maxPrice: validPrices.length ? Math.max(...validPrices) : null,
    };

    for (const e of entries) {
      pushMapList(duplicatesByIdMap, e.id, {
        tierFile,
        name: e.name || null,
        price: e.price,
      });

      const norm = normalizeName(e.name);
      if (norm) {
        pushMapList(duplicatesByNameMap, norm, {
          tierFile,
          id: e.id || null,
          price: e.price,
          name: e.name,
        });
      }
    }
  }

  const sortedTiers = Object.entries(tierStats)
    .filter(([, s]) => typeof s.minPrice === "number")
    .sort((a, b) => a[1].minPrice - b[1].minPrice);

  const gapHints = [];
  for (let i = 1; i < sortedTiers.length; i += 1) {
    const [prevTier, prevStats] = sortedTiers[i - 1];
    const [nextTier, nextStats] = sortedTiers[i];
    const gap = nextStats.minPrice - prevStats.maxPrice;
    if (gap > 0) {
      const gapStart = prevStats.maxPrice;
      const gapEnd = nextStats.minPrice;
      const overlaps1000to2000 = Math.max(gapStart, 1000) < Math.min(gapEnd, 2000);
      gapHints.push({
        fromTier: prevTier,
        toTier: nextTier,
        prevMaxPrice: prevStats.maxPrice,
        nextMinPrice: nextStats.minPrice,
        gapSize: gap,
        overlaps1000to2000,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inventoryDir: path.relative(root, inventoryDir),
    tierFiles: tierFiles.map((p) => path.basename(p)),
    tierStats,
    duplicatesById: toObjectOnlyDuplicates(duplicatesByIdMap),
    duplicatesByName: toObjectOnlyDuplicates(duplicatesByNameMap),
    gapHints,
    parseIssues,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Cars Audit");
  console.log(`Inventory dir: ${report.inventoryDir}`);
  console.log(`Tier files: ${report.tierFiles.length}`);
  console.log("");
  console.log("Tier stats:");
  for (const [tier, stats] of sortedTiers) {
    console.log(
      `- ${tier}: count=${stats.count} min=${stats.minPrice ?? "n/a"} max=${stats.maxPrice ?? "n/a"}`
    );
  }

  const dupIdKeys = Object.keys(report.duplicatesById);
  const dupNameKeys = Object.keys(report.duplicatesByName);
  console.log("");
  console.log(`Duplicate ids: ${dupIdKeys.length}`);
  for (const key of dupIdKeys) {
    console.log(`- id "${key}"`);
    for (const row of report.duplicatesById[key]) {
      console.log(`  - ${row.tierFile}: ${row.name ?? "(no name)"} @ ${row.price ?? "n/a"}`);
    }
  }

  console.log("");
  console.log(`Duplicate names (normalized): ${dupNameKeys.length}`);
  for (const key of dupNameKeys) {
    console.log(`- name "${key}"`);
    for (const row of report.duplicatesByName[key]) {
      console.log(`  - ${row.tierFile}: ${row.id ?? "(no id)"} @ ${row.price ?? "n/a"} (${row.name})`);
    }
  }

  console.log("");
  console.log(`Gap hints (>0): ${gapHints.length}`);
  for (const gap of gapHints) {
    const marker = gap.overlaps1000to2000 ? " [hits 1000-2000]" : "";
    console.log(
      `- ${gap.fromTier} -> ${gap.toTier}: ${gap.prevMaxPrice}..${gap.nextMinPrice} (gap ${gap.gapSize})${marker}`
    );
  }

  if (Object.keys(parseIssues).length > 0) {
    console.log("");
    console.log("Parse/data issues:");
    for (const [tier, issues] of Object.entries(parseIssues)) {
      console.log(`- ${tier}: ${issues.length}`);
    }
  }

  console.log("");
  console.log(`Saved JSON report: ${path.relative(root, reportPath)}`);
}

try {
  run();
} catch (err) {
  console.error("[cars:audit] failed", err instanceof Error ? err.message : err);
  process.exit(1);
}
