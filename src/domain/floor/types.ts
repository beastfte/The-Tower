import type { CombatStats, Position, Tile } from "../types";
import type { ArmorMaterialId, ArmorSlotId, KeyDefinition, LootItem, WeaponId } from "../character/types";

export type MonsterSpeciesId =
  | "goblin"
  | "ogre"
  | "wizard"
  | "bat"
  | "slime"
  | "skeleton"
  | "necromancer"
  | "bandit"
  | "voidwalker";

export interface MonsterSpecies {
  id: MonsterSpeciesId;
  name: string;
  baselineStats: CombatStats;
  textureKey: string;
  /** Fraction of a tile's size (0-1) this species' sprite renders at (014 FR-010, restored to
   * three tiers by 020 research R3) — "large" monsters read ~0.85-0.95, "medium" (human-scale)
   * ones ~0.75-0.85, and "small" ones ~0.5-0.65. */
  spriteScale: number;
  /** 027 FR-031/FR-032: seconds between this species' attacks. A placement's authored
   * `stats.damage` is damage per second; battle attack = damage × this (research R6). */
  attackIntervalSec: number;
  /** 027 FR-017: chance (0-1) each attack is a critical strike. */
  critChance: number;
  /** 027 FR-016: added to the 1.5 crit multiplier. */
  critDamageBonus: number;
  /** 032 FR-006: this type's default chance (0-1) to dodge an attack; 2-20% for shipped species. */
  dodgeChance: number;
}

export interface DropTable {
  loot?: LootItem[];
  currency?: number;
  key?: KeyDefinition;
}

export interface EnemyDefinition {
  id: string;
  position: Position;
  stats: CombatStats;
  species: MonsterSpeciesId;
  isEndBoss?: boolean;
  drops?: DropTable;
  /** 032 FR-007/FR-008: per-placement dodge override (0-1); absent = the species default. */
  dodgeChance?: number;
}

/** 023 FR-004: a merchant NPC — deliberately not an `EnemyDefinition`. Combat is reachable
 * only through a lookup into `floor.enemies`, so keeping merchants in their own array makes
 * "never attackable" structural rather than a runtime flag some future branch could miss.
 * Carries no `stats`/`drops`/`isEndBoss` because it is never a combat participant. */
export interface MerchantDefinition {
  id: string;
  position: Position;
}

/** 012 FR-018 (2026-09-23 gap fix): a runtime-readable catalog of item kinds, so tooling
 * (`scripts/sync-tool-palette.ts`) can derive this set instead of hand-mirroring it. Previously
 * a TypeScript union only, with no runtime representation (a `type` alone erases at
 * compile time). */
export const ITEM_KINDS = [
  "loot",
  "currency",
  "key",
  "weapon",
  "armor",
  "potion",
  "chest",
  "potionAttack",
  "potionDefense",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** 012 FR-018 (2026-09-23 gap fix): the tile-modifying hazard categories the design tool's
 * palette currently offers — "spike"/"lava"/"water" map to `spikePits`/`lavaTiles`/
 * `waterTiles` respectively. Deliberately excludes generic `HazardTileDefinition`
 * (`hazardTiles`): the design tool has never had a way to place one (spec.md's FR-006 only
 * ever named lava/spike pits/water), so it's a separate, pre-existing gap, not something this
 * catalog silently starts claiming is covered. Adding a new hazard category still requires a
 * code change (a new `FloorDefinition` array field), same as before — this catalog exists so
 * that change has one canonical place to update, and `sync-tool-palette.ts`'s drift test can
 * catch the tool's palette falling out of sync with it. */
export const HAZARD_KINDS = ["spike", "lava", "water"] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

/** A chest's one predetermined reward, fixed at authoring time (005 spec Assumptions). */
export type ChestReward = { kind: "currency"; amount: number } | { kind: "potion" };

/** 011 FR-001/FR-004: an armor pickup targets exactly one slot, replacing the old bare
 * whole-character ArmorTierId payload. */
export interface ArmorPickupPayload {
  material: ArmorMaterialId;
  slot: ArmorSlotId;
}

export type ItemPayload =
  | LootItem
  | number
  | KeyDefinition
  | WeaponId
  | ArmorPickupPayload
  | ChestReward
  | undefined;

export interface ItemDefinition {
  id: string;
  position: Position;
  kind: ItemKind;
  payload: ItemPayload;
}

export interface KeyedDoorDefinition {
  id: string;
  position: Position;
  doorType: string;
}

export interface HazardTileDefinition {
  id: string;
  position: Position;
  damage: number;
}

export interface SpikePitDefinition {
  id: string;
  position: Position;
  damage: number;
}

export interface LavaTileDefinition {
  id: string;
  position: Position;
  damage: number;
}

/** 012 FR-018 (research.md #11): a runtime-readable catalog of lever effect kinds, so tooling
 * (e.g. scripts/sync-tool-palette.ts) can derive this set instead of hand-mirroring it. The
 * TypeScript union below stays the source of truth for shape; this array mirrors its `kind`
 * literals for runtime access (a `type` alone erases at compile time). */
export const LEVER_EFFECT_KINDS = ["unlockDoor", "revealPathway", "deactivateTraps"] as const;

export type LeverEffect =
  | { kind: "unlockDoor"; doorId: string }
  | { kind: "revealPathway"; position: Position }
  | { kind: "deactivateTraps"; targetIds: string[] };

export interface LeverDefinition {
  id: string;
  position: Position;
  effect: LeverEffect;
}

export interface WaterTileDefinition {
  id: string;
  position: Position;
}

/** 013: a floor's visual wall/terrain theme; absent = "stone" (research.md #2). */
export type ZoneThemeId = "stone" | "crypt" | "cavern" | "frost" | "ember" | "arcane";

/** 013 FR-001/FR-003/FR-004: a wall that opens (becomes walkable) once collided with more
 * than CRACKED_WALL_BREAK_THRESHOLD times. A normal wall has no entry here — it's simply
 * any `walkable: false` grid cell not present in this array (research.md #1). */
export interface CrackedWallDefinition {
  id: string;
  position: Position;
}

/** 013 (session 3, FR-014 extension): overrides which zone theme a single wall tile (normal
 * or cracked) renders with, independent of the floor's own `zone` — used only to demonstrate
 * multiple zone themes' wall art side-by-side on one floor. Every wall without an entry here
 * keeps inheriting the floor's own zone exactly as before; this has no effect on collision,
 * break behavior, or reachability. */
export interface WallZoneOverride {
  position: Position;
  zone: ZoneThemeId;
}

export interface FloorDefinition {
  id: string;
  grid: Tile[][];
  entrance: Position;
  exit: Position;
  enemies: EnemyDefinition[];
  /** 023: optional, unlike every other content array — adding it as required would force an
   * edit to every existing floor literal and tower JSON. Absent = no merchant on this floor. */
  merchants?: MerchantDefinition[];
  items: ItemDefinition[];
  keyedDoors: KeyedDoorDefinition[];
  hazardTiles: HazardTileDefinition[];
  spikePits: SpikePitDefinition[];
  lavaTiles: LavaTileDefinition[];
  levers: LeverDefinition[];
  waterTiles: WaterTileDefinition[];
  crackedWalls: CrackedWallDefinition[];
  /** Absent = "stone" (research.md #2) — existing floors need no changes. */
  zone?: ZoneThemeId;
  wallZoneOverrides: WallZoneOverride[];
}
