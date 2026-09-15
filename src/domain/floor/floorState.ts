import type { PlayerCharacterState } from "../character/save";
import { applyDropTable } from "../character/inventory";
import type { FloorProgress } from "../character/save";
import type { Position } from "../types";
import type { EnemyDefinition, LeverDefinition } from "./types";

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
): FloorStateUpdate {
  const nextProgress: FloorProgress = {
    ...floorProgress,
    defeatedEnemyIds: floorProgress.defeatedEnemyIds.includes(enemy.id)
      ? floorProgress.defeatedEnemyIds
      : [...floorProgress.defeatedEnemyIds, enemy.id],
  };
  return { floorProgress: nextProgress, character: applyDropTable(character, enemy.drops) };
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
