import type { CombatStats, Position, Tile } from "../types";
import type { KeyDefinition, LootItem, PowerupDefinition } from "../character/types";

export type EnemyPlacement = "compulsory" | "optional";

export interface DropTable {
  loot?: LootItem[];
  currency?: number;
  powerup?: PowerupDefinition;
  key?: KeyDefinition;
}

export interface EnemyDefinition {
  id: string;
  position: Position;
  stats: CombatStats;
  placement: EnemyPlacement;
  isEndBoss?: boolean;
  drops?: DropTable;
}

export type ItemKind = "loot" | "currency" | "powerup" | "key";

export type ItemPayload = LootItem | number | PowerupDefinition | KeyDefinition;

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

export interface FloorDefinition {
  id: string;
  grid: Tile[][];
  entrance: Position;
  exit: Position;
  enemies: EnemyDefinition[];
  items: ItemDefinition[];
  keyedDoors: KeyedDoorDefinition[];
  hazardTiles: HazardTileDefinition[];
}
