import type { ArmorMaterialId, ArmorSlotId, WeaponId } from "./types";
import type { CombatStats } from "../types";

/** 034: a worn-gear slot: the weapon or one armour slot. */
export type GearSlot = "weapon" | ArmorSlotId;

export type GradeId = "common" | "uncommon" | "rare" | "unique" | "legendary";

export const GRADE_ORDER: readonly GradeId[] = ["common", "uncommon", "rare", "unique", "legendary"];

/** 034 data-model: colour, extra-stat count and drop weight per grade. */
export const GRADES: Record<GradeId, { name: string; colour: string; extraCount: number; dropWeight: number }> = {
  common: { name: "Common", colour: "#e6e6e6", extraCount: 0, dropWeight: 10 },
  uncommon: { name: "Uncommon", colour: "#4ade80", extraCount: 1, dropWeight: 5 },
  rare: { name: "Rare", colour: "#60a5fa", extraCount: 2, dropWeight: 3 },
  unique: { name: "Unique", colour: "#c084fc", extraCount: 3, dropWeight: 2 },
  legendary: { name: "Legendary", colour: "#fb923c", extraCount: 4, dropWeight: 1 },
};

export type ExtraStatId = "critChance" | "critDamage" | "attackSpeed" | "dodge";
/** Values are fractions (0.04 = 4%). */
export type ExtraStats = Partial<Record<ExtraStatId, number>>;

export interface GearRoll {
  grade: GradeId;
  extras: ExtraStats;
}

/** A specific piece of gear: a weapon id or "material:slot" armour key, plus its roll. */
export interface GearItem extends GearRoll {
  key: string;
}

/** The roll of a piece with no recorded roll (pre-034 saves, floor pickups). */
export const COMMON_ROLL: GearRoll = { grade: "common", extras: {} };

/** 034 C1: 10% per grade, compounding, rounded from the common value (small stats may tie). */
export function gradedValue(common: number, grade: GradeId): number {
  return Math.round(common * Math.pow(1.1, GRADE_ORDER.indexOf(grade)));
}

/** 034 research R5: whole-percent ranges, the same for every grade. */
export const EXTRA_STAT_RANGES: Record<ExtraStatId, { min: number; max: number }> = {
  critChance: { min: 2, max: 5 },
  critDamage: { min: 10, max: 25 },
  attackSpeed: { min: 5, max: 10 },
  dodge: { min: 2, max: 5 },
};

const EXTRA_IDS = Object.keys(EXTRA_STAT_RANGES) as ExtraStatId[];

/** 034 C2: a gear item of `grade` with exactly `extraCount` distinct extras. */
export function rollGear(key: string, grade: GradeId, rng: () => number): GearItem {
  const pool = [...EXTRA_IDS];
  const extras: ExtraStats = {};
  for (let i = 0; i < GRADES[grade].extraCount; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const { min, max } = EXTRA_STAT_RANGES[id];
    extras[id] = (min + Math.floor(rng() * (max - min + 1))) / 100;
  }
  return { key, grade, extras };
}

/** 034 data-model: which armour material and weapon a floor's monsters may drop. */
export function bandFor(floorNumber: number): { material: ArmorMaterialId; weapon: WeaponId } {
  if (floorNumber <= 7) return { material: "leather", weapon: "woodSword" };
  if (floorNumber <= 14) return { material: "mail", weapon: "sword" };
  return { material: "plate", weapon: "diamondSword" };
}

/** What a defeated monster leaves behind. Rolled per fight, never authored. */
export interface DropTable {
  currency?: number;
  gear?: GearItem;
}

/** Bell-shaped whole number in [lo, hi]; Box–Muller, re-rolled until in range. A source that
 * can never land in range (e.g. a test stubbing a constant) falls back to the mean after a
 * bounded number of tries rather than looping forever. */
export function rollGold(mean: number, sd: number, lo: number, hi: number, rng: () => number): number {
  for (let tries = 0; tries < 100; tries++) {
    const u = 1 - rng();
    const v = rng();
    const value = Math.round(mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    if (value >= lo && value <= hi) return value;
  }
  return Math.min(hi, Math.max(lo, Math.round(mean)));
}

const SLOT_CHOICES: GearSlot[] = ["weapon", "helm", "chest", "legs", "boots"];

function rollGrade(rng: () => number): GradeId {
  const total = GRADE_ORDER.reduce((sum, g) => sum + GRADES[g].dropWeight, 0);
  let pick = rng() * total;
  for (const g of GRADE_ORDER) {
    pick -= GRADES[g].dropWeight;
    if (pick < 0) return g;
  }
  return "common";
}

/** 034 C5: regular 20% gear / 20% nothing / 60% gold (1–10); elite 50% gear / 50% gold (10–30). */
export function rollMonsterDrop(floorNumber: number, elite: boolean, rng: () => number): DropTable {
  const roll = rng();
  if (roll < (elite ? 0.5 : 0.2)) {
    const band = bandFor(floorNumber);
    const slot = SLOT_CHOICES[Math.floor(rng() * SLOT_CHOICES.length)]!;
    const key = slot === "weapon" ? band.weapon : `${band.material}:${slot}`;
    return { gear: rollGear(key, rollGrade(rng), rng) };
  }
  if (!elite && roll < 0.4) return {};
  return { currency: elite ? rollGold(20, 5, 10, 30, rng) : rollGold(3, 3, 1, 10, rng) };
}

/** 034 C8: an elite's HP, damage and defence are ×1.5, rounded up. */
export function eliteStats(enemy: { stats: CombatStats; isElite?: boolean }): CombatStats {
  if (!enemy.isElite) return enemy.stats;
  const { hp, damage, defence } = enemy.stats;
  return { ...enemy.stats, hp: Math.ceil(hp * 1.5), damage: Math.ceil(damage * 1.5), defence: Math.ceil(defence * 1.5) };
}
