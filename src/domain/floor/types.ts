import type { CombatStats, Position, Tile } from "../types";
import type { ArmorMaterialId, ArmorSlotId, KeyDefinition, LootItem, WeaponId } from "../character/types";

export type EnemyPlacement = "compulsory" | "optional";

export type MonsterSpeciesId = "goblin" | "ogre" | "wizard";

export interface MonsterSpecies {
  id: MonsterSpeciesId;
  name: string;
  baselineStats: CombatStats;
  textureKey: string;
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
  placement: EnemyPlacement;
  species: MonsterSpeciesId;
  isEndBoss?: boolean;
  drops?: DropTable;
}

export type ItemKind =
  | "loot"
  | "currency"
  | "key"
  | "weapon"
  | "armor"
  | "potion"
  | "chest"
  | "potionAttack"
  | "potionDefense";

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
