import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "./save";
import type { ArmorPieceDefinition, ArmorSlotId, WeaponDefinition, WeaponId } from "./types";
import { armorPieceKey } from "../../data/armorPieces";
import { PLAYER_BASE_COMBAT } from "./initialState";

/** 027 (research R7): today's damage/defence/hp plus the live-battle stats. */
export interface EffectiveStats extends CombatStats {
  attackIntervalSec: number;
  critChance: number;
  critDamageBonus: number;
}

/**
 * Computes the player's effective combat stats: an equipped weapon's `attackValue` adds
 * on top of the player's base (unarmed) damage rather than replacing it (bug fix:
 * weapon-attack-not-additive — superseded 004 FR-005's original "replaces" behavior, which
 * let a low-`attackValue` weapon make the player strictly weaker than unarmed), each
 * independently-equipped armor slot adds its own defence value (011 FR-003 — sum across
 * slots, not one whole-character tier), and any Attack Potion bonus (`bonusDamage`, 011
 * FR-007) always adds on top as well. Equipping a second weapon still replaces the first
 * weapon's own contribution (only one `equippedWeaponId` slot exists), it just doesn't
 * replace the base. `hp` reflects the character's current HP (a real, persistent resource,
 * research.md #6), not max HP.
 *
 * 027 FR-033 (research R7): attack interval and crit are `PLAYER_BASE_COMBAT` plus whatever the
 * equipped weapon and armour declare. Speed bonuses are percentages of attack speed, so the
 * interval is divided by (1 + their sum): +25% turns 1s into 0.8s (SC-011).
 */
export function computeEffectiveStats(
  character: PlayerCharacterState,
  weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition>,
  armorCatalog: ReadonlyMap<string, ArmorPieceDefinition>,
): EffectiveStats {
  const weapon = character.equippedWeaponId ? weaponCatalog.get(character.equippedWeaponId) : undefined;

  const armorPieces = Object.entries(character.equippedArmor).flatMap(([slot, material]) => {
    if (!material) return [];
    const piece = armorCatalog.get(armorPieceKey(material, slot as ArmorSlotId));
    return piece ? [piece] : [];
  });
  const armorDefence = armorPieces.reduce((sum, piece) => sum + piece.defenceBonus, 0);

  const damage = character.baseStats.damage + (weapon?.attackValue ?? 0) + character.bonusDamage;
  const defence = character.baseStats.defence + armorDefence;

  const sources = weapon ? [weapon, ...armorPieces] : armorPieces;
  const sum = (pick: (s: (typeof sources)[number]) => number | undefined): number =>
    sources.reduce((total, s) => total + (pick(s) ?? 0), 0);

  return {
    damage,
    defence,
    hp: character.currentHp,
    attackIntervalSec: PLAYER_BASE_COMBAT.attackIntervalSec / (1 + sum((s) => s.attackSpeedBonus)),
    critChance: PLAYER_BASE_COMBAT.critChance + sum((s) => s.critChanceBonus),
    critDamageBonus: PLAYER_BASE_COMBAT.critDamageBonus + sum((s) => s.critDamageBonus),
  };
}

/** Computes the character's current max HP — the single funnel every HP-ceiling check
 * (hazard recovery, potions, the HUD) reads from, so a future max-HP-affecting mechanic
 * only needs to change this one function. */
export function computeMaxHp(character: PlayerCharacterState): number {
  return character.baseStats.hp;
}

/** Heals the character by a fixed amount, never exceeding `computeMaxHp` (019 FR-007) — the
 * single funnel every HP-ceiling check reads from. Calling this at full HP is a well-defined
 * no-op, not an error. Checkpoint death-recovery (`src/domain/hazard/recovery.ts`) restores to
 * full via `computeMaxHp` directly and does not go through this function. */
export function healBy(character: PlayerCharacterState, amount: number): PlayerCharacterState {
  return { ...character, currentHp: Math.min(character.currentHp + amount, computeMaxHp(character)) };
}
