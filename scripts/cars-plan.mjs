import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const inventoryDir = path.join(root, "data", "inventory");
const carsDir = path.join(root, "public", "cars");
const placeholderPath = path.join(carsDir, "placeholder.jpg");

/**
 * Returns the SHA-256 hex digest for a given file buffer.
 * @param {Buffer} buffer
 * @returns {string}
 */
function toSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readInventoryFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`[warn] Missing inventory directory: ${dirPath}`);
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Recursively collects string `id` values from any nested JSON-like structure.
 * Used only as fallback when the parsed inventory JSON is not an array.
 * @param {unknown} value
 * @param {Set<string>} ids
 */
function collectIdsFromValue(value, ids) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectIdsFromValue(item, ids);
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  if (typeof value.id === "string") {
    const trimmed = value.id.trim();
    if (trimmed) ids.add(trimmed);
  }

  for (const nested of Object.values(value)) {
    collectIdsFromValue(nested, ids);
  }
}

const inventoryFiles = readInventoryFiles(inventoryDir);
const ids = new Set();

for (const filePath of inventoryFiles) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.id !== "string") continue;
        const trimmed = item.id.trim();
        if (trimmed) ids.add(trimmed);
      }
    } else {
      collectIdsFromValue(parsed, ids);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[warn] Skipping invalid JSON file ${path.basename(filePath)}: ${msg}`);
  }
}

const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
const carsDirExists = fs.existsSync(carsDir);

let presentCount = 0;
const missingIds = carsDirExists ? [] : sortedIds.slice();
const existingImagePaths = [];

if (!carsDirExists) {
  console.warn(`[warn] Missing cars directory: ${carsDir}`);
  console.warn("[warn] All images are treated as missing.");
} else {
  for (const id of sortedIds) {
    const imagePath = path.join(carsDir, `${id}.jpg`);
    if (fs.existsSync(imagePath)) {
      presentCount += 1;
      existingImagePaths.push({ id, imagePath });
    } else {
      missingIds.push(id);
    }
  }
}

console.log("=== Cars Image Plan Report ===");
console.log(`Inventory files read: ${inventoryFiles.length}`);
console.log(`Unique car ids: ${sortedIds.length}`);
console.log(`Images present: ${presentCount}`);
console.log(`Images missing: ${missingIds.length}`);

if (missingIds.length > 0) {
  console.log("");
  console.log("Missing ids:");
  for (const id of missingIds) {
    console.log(id);
  }
}

if (!carsDirExists) console.warn("");

let placeholderIds = [];
if (!carsDirExists) {
  console.warn("[warn] Placeholder detection disabled (cars directory not found).");
} else if (!fs.existsSync(placeholderPath)) {
  console.warn(`[warn] Placeholder detection disabled (missing ${placeholderPath}).`);
} else {
  try {
    const placeholderHash = toSha256(fs.readFileSync(placeholderPath));
    placeholderIds = existingImagePaths
      .filter(({ imagePath }) => {
        try {
          const hash = toSha256(fs.readFileSync(imagePath));
          return hash === placeholderHash;
        } catch {
          return false;
        }
      })
      .map(({ id }) => id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[warn] Placeholder detection error: ${msg}`);
  }
}

console.log("");
console.log(`Placeholder images: ${placeholderIds.length}`);
if (placeholderIds.length > 0) {
  console.log("Placeholder ids:");
  for (const id of placeholderIds) {
    console.log(id);
  }
}

console.log("");
console.log("Suggested command:");
console.log("npm run ensure:car-images");
