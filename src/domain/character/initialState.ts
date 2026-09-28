import type { Position } from "../types";
import { emptyFloorProgress, type PlayerSave } from "./save";

/** Base combat stats for a brand-new playable character. */
const BASE_PLAYER_STATS = {
  damage: 10,
  defence: 2,
  hp: 30,
};

/** Builds a fresh PlayerSave for a brand-new game (no prior save found). */
export function createInitialPlayerSave(firstFloorId: string, entrance: Position): PlayerSave {
  const character = {
    baseStats: { ...BASE_PLAYER_STATS },
    currentHp: BASE_PLAYER_STATS.hp,
    inventory: [],
    currency: 0,
    keyIds: [],
    equippedArmor: {},
    bonusDamage: 0,
  };
  return {
    currentFloorId: firstFloorId,
    currentFloorState: emptyFloorProgress(firstFloorId, entrance),
    completedFloorIds: [],
    completedFloorStates: {},
    character,
    // bug fix: checkpoint-restart-stat-exploit — the checkpoint for a brand-new game is the
    // starting character itself.
    checkpointCharacter: { ...character },
    hasWon: false,
    isDead: false,
  };
}
