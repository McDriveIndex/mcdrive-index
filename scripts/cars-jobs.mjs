import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const inventoryDir = path.join(root, "data", "inventory");
const carsDir = path.join(root, "public", "cars");
const placeholderPath = path.join(carsDir, "placeholder.jpg");
const jobsDir = path.join(root, "data", "cars", "jobs");

function printUsageAndExit(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node scripts/cars-jobs.mjs [--placeholders|--all|--id <carId>] [--force] [--dry-run]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    selectorMode: "placeholders",
    id: null,
    force: false,
    dryRun: false,
  };

  function setSelectorMode(nextMode) {
    if (opts.selectorMode !== "placeholders" && opts.selectorMode !== nextMode) {
      printUsageAndExit("Use only one selector among --placeholders, --all, --id.");
    }
    opts.selectorMode = nextMode;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--placeholders") {
      setSelectorMode("placeholders");
      continue;
    }

    if (arg === "--all") {
      setSelectorMode("all");
      continue;
    }

    if (arg === "--id") {
      setSelectorMode("id");
      if (i + 1 >= argv.length) printUsageAndExit("Missing value for --id.");
      const id = String(argv[i + 1] ?? "").trim();
      if (!id) printUsageAndExit("Invalid value for --id.");
      opts.id = id;
      i += 1;
      continue;
    }

    if (arg === "--force") {
      opts.force = true;
      continue;
    }

    if (arg === "--dry-run") {
      opts.dryRun = true;
      continue;
    }

    printUsageAndExit(`Unknown flag: ${arg}`);
  }

  return {
    mode: opts.selectorMode,
    id: opts.id,
    force: opts.force,
    dryRun: opts.dryRun,
  };
}

function toSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeInventoryItem(item, tier) {
  if (!item || typeof item !== "object") return null;

  const rawId = typeof item.id === "string" ? item.id.trim() : "";
  if (!rawId) return null;

  let name = "";
  if (typeof item.name === "string" && item.name.trim()) {
    name = item.name.trim();
  } else if (
    typeof item.make === "string" &&
    item.make.trim() &&
    typeof item.model === "string" &&
    item.model.trim()
  ) {
    name = `${item.make.trim()} ${item.model.trim()}`;
  } else {
    name = rawId;
  }

  const normalized = {
    id: rawId,
    name,
    vibe: typeof item.vibe === "string" ? item.vibe : "",
    tier,
    price_usd: typeof item.price_usd === "number" && Number.isFinite(item.price_usd) ? item.price_usd : 0,
    imagePath: `/cars/${rawId}.jpg`,
  };

  if (Array.isArray(item.tags)) {
    const tags = item.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0);
    if (tags.length > 0) normalized.tags = tags;
  }

  if (typeof item.copy === "string" && item.copy.trim().length > 0) {
    normalized.copy = item.copy;
  }

  return normalized;
}

function readInventoryJobs() {
  if (!fs.existsSync(inventoryDir)) {
    console.warn(`[warn] Missing inventory directory: ${inventoryDir}`);
    return new Map();
  }

  const files = fs
    .readdirSync(inventoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const jobsById = new Map();

  for (const filename of files) {
    const tier = path.basename(filename, ".json");
    const filePath = path.join(inventoryDir, filename);

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.warn(`[warn] Skipping non-array inventory file: ${filename}`);
        continue;
      }

      for (const item of parsed) {
        const job = normalizeInventoryItem(item, tier);
        if (!job) continue;
        if (!jobsById.has(job.id)) {
          jobsById.set(job.id, job);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[warn] Skipping invalid inventory file ${filename}: ${message}`);
    }
  }

  return jobsById;
}

function getPlaceholderTargets(ids) {
  if (!fs.existsSync(placeholderPath)) {
    console.error(`Missing placeholder image: ${placeholderPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(carsDir)) {
    console.warn(`[warn] Missing cars directory: ${carsDir}`);
    return [];
  }

  const placeholderHash = toSha256(fs.readFileSync(placeholderPath));
  const targets = [];

  for (const id of ids) {
    const imagePath = path.join(carsDir, `${id}.jpg`);
    if (!fs.existsSync(imagePath)) continue;

    try {
      const imageHash = toSha256(fs.readFileSync(imagePath));
      if (imageHash === placeholderHash) targets.push(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[warn] Failed to inspect image for ${id}: ${message}`);
    }
  }

  return targets;
}

function writeJobFile(job, force) {
  const jobPath = path.join(jobsDir, `${job.id}.json`);
  const exists = fs.existsSync(jobPath);

  if (exists && !force) {
    return { written: false, skipped: true };
  }

  fs.writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return { written: true, skipped: false };
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const jobsById = readInventoryJobs();
  const inventoryIds = [...jobsById.keys()].sort((a, b) => a.localeCompare(b));

  let targetIds = [];

  if (opts.mode === "id" && opts.id) {
    targetIds = [opts.id];
    if (!jobsById.has(opts.id)) {
      console.warn(`[warn] id not found in inventory: ${opts.id}; creating minimal job.`);
      jobsById.set(opts.id, {
        id: opts.id,
        name: opts.id,
        vibe: "",
        tier: "unknown",
        price_usd: 0,
        imagePath: `/cars/${opts.id}.jpg`,
      });
    }
  } else if (opts.mode === "all") {
    targetIds = inventoryIds;
  } else {
    targetIds = getPlaceholderTargets(inventoryIds);
  }

  console.log("Cars Jobs");

  if (opts.dryRun) {
    console.log(`[dry-run] ids (${targetIds.length}):`);
    for (const id of targetIds) console.log(id);
    console.log("Summary:");
    console.log(`- mode: ${opts.mode}`);
    console.log(`- targets: ${targetIds.length}`);
    console.log("- written: 0");
    console.log("- skipped: 0");
    console.log(`- output dir: ${jobsDir}`);
    return;
  }

  fs.mkdirSync(jobsDir, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (const id of targetIds) {
    const job = jobsById.get(id);
    if (!job) {
      skipped += 1;
      continue;
    }

    const result = writeJobFile(job, opts.force);
    if (result.written) {
      written += 1;
    } else if (result.skipped) {
      skipped += 1;
    }
  }

  console.log("Summary:");
  console.log(`- mode: ${opts.mode}`);
  console.log(`- targets: ${targetIds.length}`);
  console.log(`- written: ${written}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- output dir: ${jobsDir}`);
}

run();
