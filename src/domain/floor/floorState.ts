import type { PlayerCharacterState } from "../character/save";
import { applyDropTable } from "../character/inventory";
import type { FloorProgress } from "../character/save";
import type { DropTable } from "../character/grades";
import type { Position } from "../types";
import type { CrackedWallDefinition, EnemyDefinition, KeyedDoorDefinition, LeverDefinition } from "./types";

export interface FloorStateUpdate {
  floorProgress: FloorProgress;
  character: PlayerCharacterState;
}

/**
 * Enemy-defeat state transition (FR-005): the enemy is removed from the floor
 * (recorded as defeated for this attempt) and its DropTable is applied to the
 * character. Pure — callers persist the result via PersistenceService.
 */
export function applyEnemyDefeat(
  floorProgress: FloorProgress,
  character: PlayerCharacterState,
  enemy: EnemyDefinition,
  drops?: DropTable,
): FloorStateUpdate {
  const nextProgress: FloorProgress = {
    ...floorProgress,
    defeatedEnemyIds: floorProgress.defeatedEnemyIds.includes(enemy.id)
      ? floorProgress.defeatedEnemyIds
      : [...floorProgress.defeatedEnemyIds, enemy.id],
  };
  return { floorProgress: nextProgress, character: applyDropTable(character, drops) };
}

/** Records the player's current position within the floor attempt (for exact resume, FR-010). */
export function updatePlayerPosition(
  floorProgress: FloorProgress,
  position: Position,
): FloorProgress {
  return { ...floorProgress, playerPosition: position };
}

/** Records an item as collected for this floor attempt (FR-010a). */
export function markItemCollected(floorProgress: FloorProgress, itemId: string): FloorProgress {
  if (floorProgress.collectedItemIds.includes(itemId)) return floorProgress;
  return { ...floorProgress, collectedItemIds: [...floorProgress.collectedItemIds, itemId] };
}

/** 007 US3 (FR-008): records a lever as permanently toggled for this floor attempt.
 * Idempotent — toggling an already-toggled lever is a no-op, mirroring markItemCollected. */
export function applyLeverToggle(
  floorProgress: FloorProgress,
  lever: LeverDefinition,
): FloorProgress {
  if (floorProgress.toggledLeverIds.includes(lever.id)) return floorProgress;
  return { ...floorProgress, toggledLeverIds: [...floorProgress.toggledLeverIds, lever.id] };
}

/** 010 US1 (FR-001): the first time a player passes through a keyed door they hold a matching
 * key for, that key is consumed and the door is permanently marked open for this floor attempt.
 * Idempotent (a no-op once the door is already open) and defensive (a no-op if no matching key
 * is held), mirroring applyLeverToggle's shape. `keyIds` holds one entry per held key (not a
 * count, per save.ts), so consuming one removes a single matching entry, not all of them. */
export function applyDoorOpen(
  floorProgress: FloorProgress,
  character: PlayerCharacterState,
  door: KeyedDoorDefinition,
): FloorStateUpdate {
  if (floorProgress.openedDoorIds.includes(door.id)) {
    return { floorProgress, character };
  }
  const keyIndex = character.keyIds.indexOf(door.doorType);
  if (keyIndex === -1) {
    return { floorProgress, character };
  }
  const nextKeyIds = [...character.keyIds];
  nextKeyIds.splice(keyIndex, 1);
  return {
    floorProgress: { ...floorProgress, openedDoorIds: [...floorProgress.openedDoorIds, door.id] },
    character: { ...character, keyIds: nextKeyIds },
  };
}

/** 013 FR-003: records one collision against a cracked wall for this floor attempt.
 * Always increments (unlike applyLeverToggle's idempotent no-op) — every blocked collision,
 * including ones after the wall has already broken, counts toward the total (data-model.md). */
export function applyWallCollision(
  floorProgress: FloorProgress,
  wall: CrackedWallDefinition,
): FloorProgress {
  const current = floorProgress.crackedWallHitCounts[wall.id] ?? 0;
  return {
    ...floorProgress,
    crackedWallHitCounts: { ...floorProgress.crackedWallHitCounts, [wall.id]: current + 1 },
  };
}
