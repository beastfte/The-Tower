import type { GameContext } from "./GameContext";
import type { BattleOutcome } from "../domain/combat/battle";
import type { EnemyDefinition } from "../domain/floor/types";
import { applyEnemyDefeat } from "../domain/floor/floorState";
import { markDead } from "../domain/hazard/death";
import { isWinningDefeat, triggerWin } from "../domain/progress/winState";
import { describeDrops, formatBagFullEntry } from "./eventLog/formatEntry";
import { fitDropsToBag } from "../domain/character/bag";

export type BattleEndOutcome = Exclude<BattleOutcome, "ongoing">;

export interface BattleEndResult {
  outcome: BattleEndOutcome;
  /** The player's HP as it stood in the battle at the moment it ended. */
  playerHp: number;
  potionCount: number;
}

/**
 * 027 (research R13, contract C14): applies a finished battle to the save and logs its single
 * line. Called once, the instant the battle ends and before any outcome panel, so the result is
 * persisted even if the game is closed while the panel is up. Phaser-free so it's integration-
 * testable; FloorScene only handles navigation afterwards.
 *
 * Every outcome writes back the player's HP *as it stood in the battle* and the potion count
 * first — fleeing must neither refund lost HP nor refund drunk potions (FR-021).
 */
export function applyBattleResult(
  ctx: GameContext,
  enemy: EnemyDefinition,
  enemyName: string,
  result: BattleEndResult,
): void {
  ctx.save.character = { ...ctx.save.character, currentHp: result.playerHp, potionCount: result.potionCount };

  if (result.outcome === "victory") {
    // 033 FR-016a: loot the bag cannot take is lost for good; gold and keys are always kept.
    const fit = fitDropsToBag(ctx.save.character, enemy.drops);
    const update = applyEnemyDefeat(ctx.save.currentFloorState, ctx.save.character, { ...enemy, drops: fit.drops });
    ctx.save.currentFloorState = update.floorProgress;
    ctx.save.character = update.character;
    // FR-024: one line per battle — drops (including a key) are folded in, not logged apart.
    ctx.logBattle({ outcome: "victory", enemyName, loot: describeDrops(fit.drops) });
    for (const lost of fit.lost) ctx.logEntry(formatBagFullEntry(lost.name, "lost"));
    if (isWinningDefeat(enemy)) ctx.save = triggerWin(ctx.save);
  } else if (result.outcome === "defeat") {
    ctx.save = markDead(ctx.save, enemyName); // FR-029: saved before Continue
    ctx.logBattle({ outcome: "defeat", enemyName });
  } else {
    // Fled (FR-022): the monster is left untouched and keeps full HP for next time.
    ctx.logBattle({ outcome: "fled", enemyName });
  }
  ctx.persist();
}
