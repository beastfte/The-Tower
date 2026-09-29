import type { Turn } from "../domain/combat/simulateEncounter";

export interface FoldedTurns {
  lines: string[];
  playerHp: number;
  enemyHp: number;
}

/**
 * 022 US2 (research R5/R10, contract C6): folds a run of turns into display lines with running
 * HP, matching exactly what `CombatOverlay`'s incremental paced reveal has always shown. Pure and
 * Phaser-free so both the one-turn-at-a-time reveal and the skip-to-everything path can share this
 * single implementation instead of risking the two drifting apart (stale HP on the last lines).
 */
export function foldTurnsToLines(
  turns: readonly Turn[],
  startPlayerHp: number,
  startEnemyHp: number,
  enemyName: string,
): FoldedTurns {
  let playerHp = startPlayerHp;
  let enemyHp = startEnemyHp;
  const lines: string[] = [];
  for (const turn of turns) {
    if (turn.attacker === "player") {
      enemyHp = turn.defenderHpAfter;
    } else {
      playerHp = turn.defenderHpAfter;
    }
    const attackerLabel = turn.attacker === "player" ? "You" : enemyName;
    lines.push(
      `${attackerLabel} attack for ${turn.damageDealt} dmg — You: ${playerHp} HP | ${enemyName}: ${enemyHp} HP`,
    );
  }
  return { lines, playerHp, enemyHp };
}
