import povertyRaw from "../data/inventory/poverty.json";
import usedBeatersRaw from "../data/inventory/used-beaters.json";
import usedIconsRaw from "../data/inventory/used-icons.json";
import usedLegendsRaw from "../data/inventory/used-legends.json";
import newCarsRaw from "../data/inventory/new-cars.json";
import exoticsRaw from "../data/inventory/exotics.json";

export type InventoryItem = {
  id: string;
  name: string;
  price_usd: number;
  vibe: string;
  image: string;
  copy?: string;
  tags?: string[];
};

// legacy support (new-cars.json currently may have make/model)
type LegacyNewCar = {
  id: string;
  make: string;
  model: string;
  price_usd: number;
  vibe: string;
};

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "car";
}

const usedIdsGlobal = new Set<string>();
const warnedDuplicateExplicitIds = new Set<string>();

function normalize(list: any[]): InventoryItem[] {
  return (list || []).map((x) => {
    const fromLegacy = typeof x?.make === "string" && typeof x?.model === "string";
    const name =
      typeof x?.name === "string"
        ? x.name
        : fromLegacy
          ? `${(x as LegacyNewCar).make} ${(x as LegacyNewCar).model}`
          : String(x?.name ?? "Unknown item");

    const hasExplicitId = typeof x?.id === "string" && x.id.trim().length > 0;
    const baseId = hasExplicitId ? x.id.trim() : slugifyName(name);

    let id = baseId || "car";
    if (!hasExplicitId) {
      let suffix = 2;
      while (usedIdsGlobal.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
    } else if (usedIdsGlobal.has(id) && !warnedDuplicateExplicitIds.has(id)) {
      console.warn(`[inventory] duplicate explicit id: ${id} (${name})`);
      warnedDuplicateExplicitIds.add(id);
    }
    usedIdsGlobal.add(id);

    const image =
      typeof x?.image === "string" && x.image.trim().length > 0
        ? x.image
        : `/cars/${id}.jpg`;

    return {
      id,
      name,
      price_usd: Number(x?.price_usd ?? 0),
      vibe: String(x?.vibe ?? ""),
      image: image || "/cars/placeholder.jpg",
      copy: typeof x?.copy === "string" ? x.copy : undefined,
      tags: Array.isArray(x?.tags) ? x.tags : undefined,
    };
  });
}

const poverty = normalize(povertyRaw as any[]);
const usedBeaters = normalize(usedBeatersRaw as any[]);
const usedIcons = normalize(usedIconsRaw as any[]);
const usedLegends = normalize(usedLegendsRaw as any[]);
const newCars = normalize(newCarsRaw as any[]);
const exotics = normalize(exoticsRaw as any[]);

export type MatchResult = {
  tier:
    | "poverty"
    | "used-beaters"
    | "used-icons"
    | "used-legends"
    | "new-cars"
    | "exotics";
  bestMatch: InventoryItem | null;
  alternatives: InventoryItem[];
};

function sortByPriceAsc(list: InventoryItem[]) {
  return list.slice().sort((a, b) => a.price_usd - b.price_usd);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Simple deterministic hash (stable across runs)
function hashStringToInt(str: string) {
  let h = 2166136261; // FNV-ish
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Index-style pick with controlled variety:
 * - consider only affordable items
 * - build a "top band" = top 10% (clamped 3..8 items)
 * - choose 1 deterministically from that band using seed
 * - alternatives are the remaining band items (closest neighbors)
 */
function pickIndexStyle(
  list: InventoryItem[],
  budgetUsd: number,
  seed: string
): { best: InventoryItem | null; alts: InventoryItem[] } {
  const sorted = sortByPriceAsc(list);
  const affordable = sorted.filter((x) => x.price_usd <= budgetUsd);

  if (affordable.length === 0) return { best: null, alts: [] };

  const bandSize = clamp(Math.round(affordable.length * 0.1), 3, 8);
  const band = affordable.slice(Math.max(0, affordable.length - bandSize));

  const idx = hashStringToInt(seed) % band.length;
  const best = band[idx];

  // alternatives = other band items, ordered by closeness to budget (desc price is fine)
  const alts = band
    .filter((x) => x.id !== best.id)
    .slice()
    .sort((a, b) => b.price_usd - a.price_usd)
    .slice(0, 3);

  return { best, alts };
}

function pickPersonaDeterministic(seed: string) {
  // 60% normie, 40% enthusiast
  const roll = hashStringToInt(seed) % 100;
  return roll < 60 ? "normie" : "enthusiast";
}

function ensureBestMatchFields(best: InventoryItem | null): InventoryItem | null {
  if (!best) return best;

  const fallbackId = slugifyName(best.name || "car");
  const id = typeof best.id === "string" && best.id.trim().length > 0 ? best.id : fallbackId;
  const image =
    typeof best.image === "string" && best.image.trim().length > 0
      ? best.image
      : `/cars/${id}.jpg`;

  return {
    ...best,
    id,
    image: image || "/cars/placeholder.jpg",
  };
}

export function matchCars(btcUsd: number, dateSeed?: string): MatchResult {
  const date = dateSeed ?? "no-date";
  const baseSeed = `${date}:${Math.floor(btcUsd)}`;

  // Base tiers (pre-30k)
  if (btcUsd < 5000) {
    const { best, alts } = pickIndexStyle(poverty, btcUsd, `${baseSeed}:poverty`);
    const alternatives = alts
      .map((alt) => ensureBestMatchFields(alt))
      .filter((alt): alt is InventoryItem => alt !== null);
    return {
      tier: "poverty",
      bestMatch: ensureBestMatchFields(best),
      alternatives,
    };
  }

  if (btcUsd < 10000) {
    const { best, alts } = pickIndexStyle(usedBeaters, btcUsd, `${baseSeed}:beater`);
    const alternatives = alts
      .map((alt) => ensureBestMatchFields(alt))
      .filter((alt): alt is InventoryItem => alt !== null);
    return {
      tier: "used-beaters",
      bestMatch: ensureBestMatchFields(best),
      alternatives,
    };
  }

  if (btcUsd < 30000) {
    const { best, alts } = pickIndexStyle(usedIcons, btcUsd, `${baseSeed}:icons`);
    const alternatives = alts
      .map((alt) => ensureBestMatchFields(alt))
      .filter((alt): alt is InventoryItem => alt !== null);
    return {
      tier: "used-icons",
      bestMatch: ensureBestMatchFields(best),
      alternatives,
    };
  }

  // Persona engine (>= 30k) — single result, invisible persona
  const persona = pickPersonaDeterministic(`${baseSeed}:persona`);

  // Decide which catalog to use
  // Normie leans new-cars (and sometimes exotics when budget huge)
  // Enthusiast leans used-icons + used-legends (and exotics if budget huge)
  let tier: MatchResult["tier"];
  let catalog: InventoryItem[];

  const EXOTICS_MIN = 150000; // when exotics can appear (tweak anytime)

  if (btcUsd >= EXOTICS_MIN) {
    // Once budget is huge, allow exotics for both personas (still deterministic)
    // but keep some chance for persona-appropriate non-exotic picks.
    const roll = hashStringToInt(`${baseSeed}:exotic-roll`) % 100;

    if (persona === "normie") {
      // 70% new-cars, 30% exotics
      if (roll < 30) {
        tier = "exotics";
        catalog = exotics;
      } else {
        tier = "new-cars";
        catalog = newCars;
      }
    } else {
      // enthusiast: 55% exotics, 45% legends
      if (roll < 55) {
        tier = "exotics";
        catalog = exotics;
      } else {
        tier = "used-legends";
        catalog = usedLegends;
      }
    }
  } else {
    // No exotics yet, pick between new-cars vs legends/icons
    if (persona === "normie") {
      tier = "new-cars";
      catalog = newCars;
    } else {
      tier = "used-legends";
      catalog = usedLegends.length ? usedLegends : usedIcons;
    }
  }

  const { best, alts } = pickIndexStyle(catalog, btcUsd, `${baseSeed}:${tier}`);
  const alternatives = alts
    .map((alt) => ensureBestMatchFields(alt))
    .filter((alt): alt is InventoryItem => alt !== null);
  return { tier, bestMatch: ensureBestMatchFields(best), alternatives };
}
