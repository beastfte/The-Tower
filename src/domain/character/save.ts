import type { CombatStats, Position } from "../types";
import type { ArmorMaterialId, ArmorSlotId, WeaponId } from "./types";

/** Per-floor player progress for the floor currently being attempted, or a frozen completed floor. */
export interface FloorProgress {
  floorId: string;
  defeatedEnemyIds: string[];
  collectedItemIds: string[];
  playerPosition: Position;
  /** 007 US3: levers permanently toggled this floor attempt (FR-011); resets with the rest
   * of FloorProgress on checkpoint restart. */
  toggledLeverIds: string[];
  /** 010 US1: keyed doors permanently opened this floor attempt, independent of whether the
   * key that opened them is still held (it's consumed on open); resets with the rest of
   * FloorProgress on checkpoint restart, mirroring toggledLeverIds. */
  openedDoorIds: string[];
  /** 013 FR-003: wall id → number of player collisions against it this floor attempt. Absent
   * entries are implicitly 0. A wall is broken (walkable) once its count exceeds
   * CRACKED_WALL_BREAK_THRESHOLD — derived on read (wall.ts's isWallBroken), never stored as
   * a separate flag. */
  crackedWallHitCounts: Record<string, number>;
}

export interface PlayerCharacterState {
  baseStats: CombatStats;
  currentHp: number;
  inventory: string[];
  currency: number;
  /** Held key *types* (KeyDefinition.keyType values) — a KeyedDoorDefinition is passable
   * once its doorType appears here (FR-013a). */
  keyIds: string[];
  /** Absent = unarmed (FR-010's Edge Cases baseline). */
  equippedWeaponId?: WeaponId;
  /** 011 FR-001/FR-003/FR-004: independent per-slot equip state. An absent key means that slot
   * is unequipped. New saves start with `{}` — no migration from the old single-tier system
   * (011 spec Clarifications). */
  equippedArmor: Partial<Record<ArmorSlotId, ArmorMaterialId>>;
  /** 011 FR-007/FR-008: Attack Potion's permanent bonus, tracked separately from
   * `baseStats.damage` and from any equipped weapon's `attackValue` — all three are additive
   * (see computeEffectiveStats) — this field is always additive regardless of weapon state. */
  bonusDamage: number;
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
    toggledLeverIds: [],
    openedDoorIds: [],
    crackedWallHitCounts: {},
  };
}
