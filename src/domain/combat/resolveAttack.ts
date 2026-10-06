import type { CombatStats } from "../types";

/**
 * Flat per-hit damage: max(0, attacker.damage - defender.defence). Combat no longer uses this
 * (see `resolveHit`); it remains the trap/hazard damage rule (`hazard/hazardDamage.ts`), which
 * 027 deliberately leaves unchanged (spec Assumptions: no change to trap damage).
 */
export function resolveAttack(attacker: CombatStats, defender: CombatStats): number {
  return Math.max(0, attacker.damage - defender.defence);
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
 * 027 FR-011/FR-012 (contract C4): one hit in a live battle.
 * Defence is scaled by the attacker's interval, so it removes a fixed amount of damage *per
 * second* regardless of how often the attacker swings. The crit multiplier (1.5 + bonus,
 * FR-016) applies after defence, and rounding up is the very last step.
 *
 * The `- 1e-9` guards binary-fraction error: `10 - 5 * 0.6` is 7.000000000000001, which a bare
 * ceil would turn into 8 (research R4). Real fractional damage (e.g. 2.5) still rounds up.
 */
export function resolveHit(attacker: HitAttacker, defender: HitDefender, isCrit: boolean): number {
  const raw = Math.max(0, attacker.attack - defender.defence * attacker.attackIntervalSec);
  const multiplier = isCrit ? 1.5 + attacker.critDamageBonus : 1;
  return Math.max(0, Math.ceil(raw * multiplier - 1e-9));
}
