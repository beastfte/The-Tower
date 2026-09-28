import { emptyFloorProgress, type PlayerSave } from "../character/save";
import { computeMaxHp } from "../character/combatStats";
import type { FloorDefinition } from "../floor/types";

/**
 * FR-013d option 1 / 003-pause-menu FR-005: "resume from last checkpoint" — the checkpoint is
 * the current floor's entrance. Resets that floor's FloorProgress to its original fixed state
 * and restores the character to the exact state it was in when this floor attempt began
 * (`checkpointCharacter`), healed to full HP. `completedFloorIds`/`completedFloorStates` (and
 * anything earned before this floor attempt began) are untouched — only what happened
 * *during* the current, not-yet-completed attempt is undone.
 *
 * bug fix: checkpoint-restart-stat-exploit — previously this only reset floor-local state and
 * healed HP, leaving inventory/currency/keys/equipment/potion bonuses at whatever the player
 * had accumulated so far this attempt. Since attack/defense potions stack without limit
 * (itemCollection.ts), repeatedly collecting a potion and restarting let a player farm
 * unbounded stat bonuses. `checkpointCharacter` is absent on a save persisted before this
 * field existed; fall back to the current character rather than crash in that case (that save
 * simply can't undo attempt-local character changes, same as before this fix).
 */
export function resumeFromCheckpoint(save: PlayerSave, floor: FloorDefinition): PlayerSave {
  const checkpointCharacter = save.checkpointCharacter ?? save.character;
  return {
    ...save,
    isDead: false,
    currentFloorState: emptyFloorProgress(floor.id, floor.entrance),
    character: {
      ...checkpointCharacter,
      currentHp: computeMaxHp(checkpointCharacter),
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
