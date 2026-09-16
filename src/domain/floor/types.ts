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
}
