import type { CombatStats } from "../types";

/** 038: defence is a diminishing reduction — a hit lands at K / (K + defence) of its size, so
 * 10 defence halves it and no amount of defence ever cancels it. */
export const DEFENCE_K = 10;

export function defenceMultiplier(defence: number): number {
  return DEFENCE_K / (DEFENCE_K + Math.max(0, defence));
}

/**
 * Trap/hazard damage (`hazard/hazardDamage.ts`): the same diminishing defence as combat, no
 * crit, no rounding.
 */
export function resolveAttack(attacker: CombatStats, defender: CombatStats): number {
  return Math.max(0, attacker.damage) * defenceMultiplier(defender.defence);
}

export interface HitAttacker {
  attack: number;
  attackIntervalSec: number;
  critDamageBonus: number;
}

export interface HitDefender {
  defence: number;
}

/**
 * One hit in a live battle (038, supersedes 027 FR-011/C4's flat per-second defence and
 * round-up). The hit is reduced by `defenceMultiplier`, then the crit multiplier (1.5 + bonus,
 * FR-016) applies. Damage is fractional; the UI rounds what it shows.
 */
export function resolveHit(attacker: HitAttacker, defender: HitDefender, isCrit: boolean): number {
  const multiplier = isCrit ? 1.5 + attacker.critDamageBonus : 1;
  return Math.max(0, attacker.attack) * defenceMultiplier(defender.defence) * multiplier;
}

/** A hit as shown to the player: one decimal place, no trailing ".0". */
export function formatDamage(damage: number): string {
  return String(Math.round(damage * 10) / 10);
}
