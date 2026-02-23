import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root = process.cwd();
const jobsDir = path.join(root, "data", "cars", "jobs");
const rendersDir = path.join(root, "data", "cars", "renders");
const carsDir = path.join(root, "public", "cars");
const manifestPath = path.join(root, "data", "cars", "manifest.json");
const manifestDir = path.dirname(manifestPath);
const placeholderPath = path.join(carsDir, "placeholder.jpg");

const BASE_MANIFEST = {
  _style: { locked: true, note: "style locked; generate once; append only" },
  cars: {},
};

function printUsageAndExit(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/cars-import.mjs [--all|--id <carId>] [--dry-run] [--force]");
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    mode: "default",
    id: null,
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--all") {
      if (opts.mode === "id") printUsageAndExit("Cannot combine --all with --id.");
      opts.mode = "all";
      continue;
    }

    if (arg === "--id") {
      if (opts.mode === "all") printUsageAndExit("Cannot combine --id with --all.");
      if (opts.mode === "id") printUsageAndExit("Cannot pass --id multiple times.");
      if (i + 1 >= argv.length) printUsageAndExit("Missing value for --id.");
      const id = String(argv[i + 1] ?? "").trim();
      if (!id) printUsageAndExit("Invalid value for --id.");
      opts.mode = "id";
      opts.id = id;
      i += 1;
      continue;
    }

    if (arg === "--dry-run") {
      opts.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      opts.force = true;
      continue;
    }

    printUsageAndExit(`Unknown flag: ${arg}`);
  }

  return {
    mode: opts.mode === "default" ? "all" : opts.mode,
    id: opts.id,
    dryRun: opts.dryRun,
    force: opts.force,
  };
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    return { _style: { ...BASE_MANIFEST._style }, cars: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const style = parsed && typeof parsed === "object" && parsed._style ? parsed._style : BASE_MANIFEST._style;
    const cars = parsed && typeof parsed === "object" && parsed.cars && typeof parsed.cars === "object" ? parsed.cars : {};

    return {
      _style: {
        locked: style.locked === true,
        note: typeof style.note === "string" && style.note.trim() ? style.note : BASE_MANIFEST._style.note,
      },
      cars: { ...cars },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[warn] Invalid manifest, recreating: ${message}`);
    return { _style: { ...BASE_MANIFEST._style }, cars: {} };
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function readJobIds() {
  if (!fs.existsSync(jobsDir)) {
    console.warn(`[warn] Missing jobs directory: ${jobsDir}`);
    return [];
  }

  return fs
    .readdirSync(jobsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.basename(entry.name, ".json"))
    .filter((id) => id.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
}

function findRenderSource(id) {
  const jpg = path.join(rendersDir, `${id}.jpg`);
  if (fs.existsSync(jpg)) return jpg;

  const jpeg = path.join(rendersDir, `${id}.jpeg`);
  if (fs.existsSync(jpeg)) return jpeg;

  const png = path.join(rendersDir, `${id}.png`);
  if (fs.existsSync(png)) return png;

  return null;
}

function toSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(rendersDir)) {
    console.warn(`[warn] Missing renders directory: ${rendersDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(placeholderPath)) {
    console.warn(`[warn] Placeholder not found (optional): ${placeholderPath}`);
  }

  let targetIds = [];
  if (opts.mode === "id" && opts.id) {
    targetIds = [opts.id];
    const knownIds = new Set(readJobIds());
    if (!knownIds.has(opts.id)) {
      console.warn(`[warn] id not found in jobs: ${opts.id}; trying import anyway.`);
    }
  } else {
    targetIds = readJobIds();
  }

  const actions = targetIds.map((id) => {
    const source = findRenderSource(id);
    const dest = path.join(carsDir, `${id}.jpg`);
    return { id, source, dest };
  });

  console.log("Cars Import");

  if (opts.dryRun) {
    for (const action of actions) {
      const sourceLabel = action.source ?? "<missing render>";
      console.log(`${action.id} -> ${sourceLabel} -> ${action.dest}`);
    }

    const missingRenders = actions.filter((x) => x.source === null).length;
    console.log("Summary:");
    console.log(`- targets: ${targetIds.length}`);
    console.log("- imported: 0");
    console.log("- skipped: 0");
    console.log(`- missingRenders: ${missingRenders}`);
    console.log(`- output dir: ${carsDir}`);
    console.log(`- renders dir: ${rendersDir}`);
    return;
  }

  fs.mkdirSync(carsDir, { recursive: true });

  const manifest = loadManifest();
  let imported = 0;
  let skipped = 0;
  let missingRenders = 0;
  let convertedPng = 0;
  const placeholderHash = fs.existsSync(placeholderPath)
    ? toSha256(fs.readFileSync(placeholderPath))
    : null;

  for (const action of actions) {
    if (!action.source) {
      missingRenders += 1;
      continue;
    }

    const destExists = fs.existsSync(action.dest);
    if (destExists && !opts.force) {
      if (placeholderHash) {
        try {
          const destHash = toSha256(fs.readFileSync(action.dest));
          if (destHash !== placeholderHash) {
            skipped += 1;
            continue;
          }
        } catch {
          skipped += 1;
          continue;
        }
      } else {
        skipped += 1;
        continue;
      }
    }

    if (action.source.toLowerCase().endsWith(".png")) {
      await sharp(action.source).jpeg({ quality: 88 }).toFile(action.dest);
      convertedPng += 1;
    } else {
      fs.copyFileSync(action.source, action.dest);
    }
    imported += 1;

    const previous =
      manifest.cars && typeof manifest.cars[action.id] === "object" && manifest.cars[action.id] !== null
        ? manifest.cars[action.id]
        : {};

    manifest.cars[action.id] = {
      ...previous,
      status: "done",
      importedAt: new Date().toISOString(),
      source: "import",
    };
  }

  saveManifest(manifest);

  console.log("Summary:");
  console.log(`- targets: ${targetIds.length}`);
  console.log(`- imported: ${imported}`);
  console.log(`- convertedPng: ${convertedPng}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- missingRenders: ${missingRenders}`);
  console.log(`- output dir: ${carsDir}`);
  console.log(`- renders dir: ${rendersDir}`);
}

run().catch((error) => {
  console.error("[cars:import] failed", error);
  process.exit(1);
});
