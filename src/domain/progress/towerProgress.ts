import { emptyFloorProgress, type PlayerSave } from "../character/save";
import type { Tower } from "../floor/tower";
import { nextFloor, previousFloor } from "../floor/tower";

/**
 * FR-010a: freezes the current floor's progress into `completedFloorStates` (permanent —
 * defeated enemies/collected items never reappear) and advances to the next floor, if any
 * (FR-009). If this was the tower's last floor, only the freeze happens.
 */
export function completeCurrentFloor(save: PlayerSave, tower: Tower): PlayerSave {
  const finishedFloorId = save.currentFloorState.floorId;
  const completedFloorIds = save.completedFloorIds.includes(finishedFloorId)
    ? save.completedFloorIds
    : [...save.completedFloorIds, finishedFloorId];
  const completedFloorStates = {
    ...save.completedFloorStates,
    [finishedFloorId]: save.currentFloorState,
  };

  const next = nextFloor(tower, finishedFloorId);
  if (!next) {
    return { ...save, completedFloorIds, completedFloorStates };
  }

  return {
    ...save,
    completedFloorIds,
    completedFloorStates,
    currentFloorId: next.id,
    currentFloorState: emptyFloorProgress(next.id, next.entrance),
  };
}

/**
 * Bug fix: backtrack-stairs-no-effect (FR-009a) — steps back to the floor immediately
 * before the current one, if any. Unlike `completeCurrentFloor`'s forward transition, this
 * restores the previous floor's already-frozen `FloorProgress` from `completedFloorStates`
 * (not a fresh/empty one), so its permanently-defeated enemies and permanently-collected
 * items stay gone (FR-010a) rather than reappearing. Leaves `completedFloorIds`/
 * `completedFloorStates` untouched — only `completeCurrentFloor` ever freezes/unfreezes
 * that record. A no-op (returns `save` unchanged) on the tower's first floor.
 */
export function returnToPreviousFloor(save: PlayerSave, tower: Tower): PlayerSave {
  const previous = previousFloor(tower, save.currentFloorState.floorId);
  if (!previous) return save;

  const previousState = save.completedFloorStates[previous.id];
  if (!previousState) return save;

  return {
    ...save,
    currentFloorId: previous.id,
    currentFloorState: previousState,
  };
}
