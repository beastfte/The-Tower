import { emptyFloorProgress, type PlayerSave } from "../character/save";
import type { Tower } from "../floor/tower";
import { nextFloor } from "../floor/tower";

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
