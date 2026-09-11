import type { PlayerSave } from "../character/save";
import type { EnemyDefinition } from "../floor/types";

/** FR-011: defeating the end-boss enemy triggers the win state. */
export function isWinningDefeat(enemy: EnemyDefinition): boolean {
  return enemy.isEndBoss === true;
}

/** FR-011a: once won, the playthrough ends — no further floor navigation/combat/collection. */
export function triggerWin(save: PlayerSave): PlayerSave {
  return { ...save, hasWon: true };
}
