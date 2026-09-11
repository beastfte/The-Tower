import type { CombatStats, Position } from "../types";
import type { ArmorTierId, WeaponId } from "./types";

/** Per-floor player progress for the floor currently being attempted, or a frozen completed floor. */
export interface FloorProgress {
  floorId: string;
  defeatedEnemyIds: string[];
  collectedItemIds: string[];
  playerPosition: Position;
}

export interface PlayerCharacterState {
  baseStats: CombatStats;
  currentHp: number;
  powerupIds: string[];
  inventory: string[];
  currency: number;
  /** Held key *types* (KeyDefinition.keyType values) — a KeyedDoorDefinition is passable
   * once its doorType appears here (FR-013a). */
  keyIds: string[];
  /** Absent = unarmed / unarmoured (FR-010's Edge Cases baseline). */
  equippedWeaponId?: WeaponId;
  equippedArmorTier?: ArmorTierId;
}

/** The single object persisted to localStorage (FR-010/FR-010a). */
export interface PlayerSave {
  currentFloorId: string;
  currentFloorState: FloorProgress;
  completedFloorIds: string[];
  completedFloorStates: Record<string, FloorProgress>;
  character: PlayerCharacterState;
  hasWon: boolean;
  isDead: boolean;
}

export function emptyFloorProgress(floorId: string, playerPosition: Position): FloorProgress {
  return {
    floorId,
    defeatedEnemyIds: [],
    collectedItemIds: [],
    playerPosition,
  };
}
