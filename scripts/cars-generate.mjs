import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const inventoryDir = path.join(root, "data", "inventory");
const carsDir = path.join(root, "public", "cars");
const placeholderPath = path.join(carsDir, "placeholder.jpg");
const manifestDir = path.join(root, "data", "cars");
const manifestPath = path.join(manifestDir, "manifest.json");

const BASE_MANIFEST = {
  _style: {
    locked: true,
    note: "style locked; generate once; append only",
  },
  cars: {},
};

function printUsageAndExit(message) {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: node scripts/cars-generate.mjs [--missing|--placeholders] [--id <carId>] [--force] [--dry-run]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    mode: "missing",
    id: null,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--missing") {
      if (opts.id) printUsageAndExit("Cannot use --missing together with --id.");
      opts.mode = "missing";
      continue;
    }

    if (arg === "--id") {
      if (opts.mode === "placeholders") {
        printUsageAndExit("Cannot use --placeholders together with --id.");
      }
      if (i + 1 >= argv.length) {
        printUsageAndExit("Missing value for --id.");
      }
      const next = String(argv[i + 1] ?? "").trim();
      if (!next) printUsageAndExit("Invalid value for --id.");
      opts.mode = "id";
      opts.id = next;
      i += 1;
      continue;
    }

    if (arg === "--placeholders") {
      if (opts.id) {
        printUsageAndExit("Cannot use --placeholders together with --id.");
      }
      opts.mode = "placeholders";
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

  return opts;
}

function toSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readInventoryIds() {
  if (!fs.existsSync(inventoryDir)) {
    console.warn(`[warn] Missing inventory directory: ${inventoryDir}`);
    return [];
  }

  const files = fs
    .readdirSync(inventoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(inventoryDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const ids = new Set();

  for (const filePath of files) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.warn(`[warn] Skipping non-array inventory file: ${path.basename(filePath)}`);
        continue;
      }

      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.id !== "string") continue;
        const id = item.id.trim();
        if (id) ids.add(id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[warn] Skipping invalid inventory file ${path.basename(filePath)}: ${message}`);
    }
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}

function ensurePlaceholderExists() {
  if (fs.existsSync(placeholderPath)) return;
  console.error(`Missing placeholder image: ${placeholderPath}`);
  process.exit(1);
}

function getPlaceholderTargets(inventoryIds) {
  if (!fs.existsSync(carsDir)) {
    console.warn(`[warn] Missing cars directory: ${carsDir}`);
    return [];
  }

  const placeholderHash = toSha256(fs.readFileSync(placeholderPath));
  const targets = [];

  for (const id of inventoryIds) {
    const imagePath = path.join(carsDir, `${id}.jpg`);
    if (!fs.existsSync(imagePath)) continue;

    try {
      const hash = toSha256(fs.readFileSync(imagePath));
      if (hash === placeholderHash) targets.push(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[warn] Failed to read ${imagePath}: ${message}`);
    }
  }

  return targets;
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    return {
      _style: { ...BASE_MANIFEST._style },
      cars: {},
    };
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);

    const style =
      parsed && typeof parsed === "object" && parsed._style && typeof parsed._style === "object"
        ? parsed._style
        : { ...BASE_MANIFEST._style };

    const cars =
      parsed && typeof parsed === "object" && parsed.cars && typeof parsed.cars === "object"
        ? parsed.cars
        : {};

    return {
      _style: {
        locked: style.locked === true,
        note:
          typeof style.note === "string" && style.note.trim().length > 0
            ? style.note
            : BASE_MANIFEST._style.note,
      },
      cars: { ...cars },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[warn] Invalid manifest file, recreating: ${message}`);
    return {
      _style: { ...BASE_MANIFEST._style },
      cars: {},
    };
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function generateImageStub({ id, destinationPath }) {
  fs.copyFileSync(placeholderPath, destinationPath);
  return { generated: true, mode: "stub" };
}

function run() {
  const opts = parseArgs(process.argv.slice(2));

  ensurePlaceholderExists();

  let targets = [];

  if (opts.mode === "id" && opts.id) {
    targets = [opts.id];
  } else {
    const inventoryIds = readInventoryIds();

    if (opts.mode === "placeholders") {
      targets = getPlaceholderTargets(inventoryIds);
    } else if (opts.force) {
      targets = inventoryIds;
    } else {
      targets = inventoryIds.filter((id) => !fs.existsSync(path.join(carsDir, `${id}.jpg`)));
    }
  }

  console.log("Cars Generate");

  if (opts.dryRun) {
    console.log(`[dry-run] targets: ${targets.length}`);
    for (const id of targets) {
      console.log(id);
    }
    console.log("Summary:");
    console.log(`- targets: ${targets.length}`);
    console.log("- created: 0");
    console.log("- skipped: 0");
    console.log("- overwritten: 0");
    return;
  }

  fs.mkdirSync(carsDir, { recursive: true });

  const manifest = loadManifest();
  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const id of targets) {
    const destinationPath = path.join(carsDir, `${id}.jpg`);
    const exists = fs.existsSync(destinationPath);

    if (exists && !opts.force) {
      skipped += 1;
      continue;
    }

    const result = generateImageStub({ id, destinationPath });
    if (!result.generated) {
      skipped += 1;
      continue;
    }

    if (exists) {
      overwritten += 1;
    } else {
      created += 1;
    }

    manifest.cars[id] = {
      status: "stub",
      generatedAt: new Date().toISOString(),
      source: "stub",
    };
  }

  saveManifest(manifest);

  console.log("Summary:");
  console.log(`- targets: ${targets.length}`);
  console.log(`- created: ${created}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- overwritten: ${overwritten}`);
}

run();
