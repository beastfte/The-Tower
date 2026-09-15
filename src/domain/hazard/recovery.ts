import { emptyFloorProgress, type PlayerSave } from "../character/save";
import { computeMaxHp } from "../character/combatStats";
import type { FloorDefinition } from "../floor/types";

/**
 * FR-013d option 1: "resume from last checkpoint" — since no mid-floor checkpoint
 * mechanism exists, the checkpoint is the current floor's entrance. Resets that floor's
 * FloorProgress to its original fixed state and restores the character to max HP.
 * `completedFloorIds`/`completedFloorStates` and all other character progress are untouched.
 */
export function resumeFromCheckpoint(save: PlayerSave, floor: FloorDefinition): PlayerSave {
  return {
    ...save,
    isDead: false,
    currentFloorState: emptyFloorProgress(floor.id, floor.entrance),
    character: {
      ...save.character,
      currentHp: computeMaxHp(save.character),
    },
  };
}

/**
 * FR-013d option 2: "return to main menu" — clears the death state only; the save is
 * otherwise left exactly as it was at the moment of death.
 */
export function returnToMainMenu(save: PlayerSave): PlayerSave {
  return { ...save, isDead: false };
}
