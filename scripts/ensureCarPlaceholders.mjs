import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inventoryDir = path.join(root, "data", "inventory");
const carsDir = path.join(root, "public", "cars");
const placeholderPath = path.join(carsDir, "placeholder.jpg");

if (!fs.existsSync(inventoryDir)) {
  console.error(`Missing inventory directory: ${inventoryDir}`);
  process.exit(1);
}

if (!fs.existsSync(placeholderPath)) {
  console.error(`Missing placeholder image: ${placeholderPath}`);
  process.exit(1);
}

const inventoryFiles = fs
  .readdirSync(inventoryDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => path.join(inventoryDir, entry.name));

const ids = new Set();

function collectIds(value) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (
    Object.prototype.hasOwnProperty.call(value, "id") &&
    typeof value.id === "string" &&
    value.id.length > 0
  ) {
    ids.add(value.id);
  }

  for (const nestedValue of Object.values(value)) {
    collectIds(nestedValue);
  }
}

for (const filePath of inventoryFiles) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  collectIds(parsed);
}

if (!fs.existsSync(carsDir)) {
  fs.mkdirSync(carsDir, { recursive: true });
}

let created = 0;
let existed = 0;

for (const id of ids) {
  const targetPath = path.join(carsDir, `${id}.jpg`);
  if (fs.existsSync(targetPath)) {
    existed += 1;
    continue;
  }

  fs.copyFileSync(placeholderPath, targetPath);
  created += 1;
}

console.log(`Inventory ids: ${ids.size}`);
console.log(`Created: ${created}`);
console.log(`Already existed: ${existed}`);
