import type { CombatStats } from "../types";
import { resolveAttack } from "./resolveAttack";

export type Side = "player" | "enemy";

export interface Turn {
  attacker: Side;
  damageDealt: number;
  defenderHpAfter: number;
}

export interface EncounterResult {
  turns: Turn[];
  winner: Side;
}

/**
 * Deterministic turn-by-turn combat simulation (FR-012, FR-012a). Alternates
 * player-attacks-first, then enemy, repeating until one side's HP reaches 0.
 * Pure: does not mutate the CombatStats passed in.
 *
 * Guards against a damage stalemate (both sides deal 0 damage to each other) by
 * declaring the enemy the winner once two consecutive turns deal no damage at all,
 * per contracts/combat-resolution-contract.md's "Edge case" section.
 */
export function simulateEncounter(player: CombatStats, enemy: CombatStats): EncounterResult {
  let playerHp = player.hp;
  let enemyHp = enemy.hp;
  const turns: Turn[] = [];
  let consecutiveZeroDamageTurns = 0;

  const attackers: Side[] = ["player", "enemy"];
  let turnIndex = 0;

  while (playerHp > 0 && enemyHp > 0) {
    const side = attackers[turnIndex % 2]!;
    let damageDealt: number;
    if (side === "player") {
      damageDealt = resolveAttack(player, { ...enemy, hp: enemyHp });
      enemyHp = Math.max(0, enemyHp - damageDealt);
    } else {
      damageDealt = resolveAttack(enemy, { ...player, hp: playerHp });
      playerHp = Math.max(0, playerHp - damageDealt);
    }
    turns.push({
      attacker: side,
      damageDealt,
      defenderHpAfter: side === "player" ? enemyHp : playerHp,
    });

    if (damageDealt === 0) {
      consecutiveZeroDamageTurns += 1;
    } else {
      consecutiveZeroDamageTurns = 0;
    }
    if (consecutiveZeroDamageTurns >= 2) {
      return { turns, winner: "enemy" };
    }

    turnIndex += 1;
  }

  const winner: Side = enemyHp <= 0 ? "player" : "enemy";
  return { turns, winner };
}
