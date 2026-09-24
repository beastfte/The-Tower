import type { CombatStats, Position, Tile } from "../types";
import type { ArmorMaterialId, ArmorSlotId, KeyDefinition, LootItem, WeaponId } from "../character/types";

export type MonsterSpeciesId = "goblin" | "ogre" | "wizard";

export interface MonsterSpecies {
  id: MonsterSpeciesId;
  name: string;
  baselineStats: CombatStats;
  textureKey: string;
  /** Fraction of a tile's size (0-1) this species' sprite renders at (014 FR-010) — "large"
   * monsters read ~0.85-0.95, "small/medium" ones ~0.5-0.65. */
  spriteScale: number;
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

/** 013 FR-011/FR-012: a decorative, non-collectible fixture placed on a wall tile that casts
 * a static glow. Never an ItemDefinition — it's never obtainable (FR-010). */
export interface TorchDefinition {
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
  items: ItemDefinition[];
  keyedDoors: KeyedDoorDefinition[];
  hazardTiles: HazardTileDefinition[];
  spikePits: SpikePitDefinition[];
  lavaTiles: LavaTileDefinition[];
  levers: LeverDefinition[];
  waterTiles: WaterTileDefinition[];
  crackedWalls: CrackedWallDefinition[];
  torches: TorchDefinition[];
  /** Absent = "stone" (research.md #2) — existing floors need no changes. */
  zone?: ZoneThemeId;
  wallZoneOverrides: WallZoneOverride[];
}
