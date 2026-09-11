import type { CombatStats } from "../types";

/**
 * Pure damage function (FR-012a, contracts/combat-resolution-contract.md):
 * damage dealt = max(0, attacker.damage - defender.defence).
 */
export function resolveAttack(attacker: CombatStats, defender: CombatStats): number {
  return Math.max(0, attacker.damage - defender.defence);
}
