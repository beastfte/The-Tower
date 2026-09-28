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
  /** bug fix: checkpoint-restart-stat-exploit — a snapshot of `character` as it stood the
   * moment the current floor attempt began (set in `createInitialPlayerSave` and
   * `completeCurrentFloor`'s advance branch). FR-005 (003-pause-menu/spec.md): "Restart at
   * last checkpoint" must undo everything gained during the current attempt, not just
   * floor-local state — `resumeFromCheckpoint` restores `character` from this field. Absent
   * on a save persisted before this field existed; callers must tolerate that (see
   * `resumeFromCheckpoint`). */
  checkpointCharacter?: PlayerCharacterState;
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

/**
 * bug fix: checkpoint-restart-stat-exploit (reopened) — a save persisted before
 * `checkpointCharacter` existed has it as `undefined` forever, since it's only ever set on a
 * *new* floor attempt (`createInitialPlayerSave`/`completeCurrentFloor`), never retroactively.
 * `resumeFromCheckpoint`'s own `?? save.character` fallback made "restart at checkpoint" a
 * complete no-op for any such save, indefinitely — silently reopening the exploit the field
 * was added to close, for every pre-existing save. Called once at load time (`main.ts`,
 * right after `persistence.load()`), this backfills the checkpoint from the character as it
 * stands *right now*, so the exploit is closed from this load onward — it cannot recover a
 * true historical snapshot for a save that never had one. Idempotent: a save that already has
 * a `checkpointCharacter` is returned untouched, never overwritten with the current (possibly
 * already-farmed) character.
 */
export function ensureCheckpointCharacter(save: PlayerSave): PlayerSave {
  if (save.checkpointCharacter) return save;
  return { ...save, checkpointCharacter: { ...save.character } };
}
