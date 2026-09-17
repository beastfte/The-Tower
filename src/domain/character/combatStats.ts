import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "./save";
import type { ArmorPieceDefinition, ArmorSlotId, WeaponDefinition, WeaponId } from "./types";
import { armorPieceKey } from "../../data/armorPieces";

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
 */
export function computeEffectiveStats(
  character: PlayerCharacterState,
  weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition>,
  armorCatalog: ReadonlyMap<string, ArmorPieceDefinition>,
): CombatStats {
  const weapon = character.equippedWeaponId ? weaponCatalog.get(character.equippedWeaponId) : undefined;

  const armorDefence = Object.entries(character.equippedArmor).reduce((sum, [slot, material]) => {
    if (!material) return sum;
    const piece = armorCatalog.get(armorPieceKey(material, slot as ArmorSlotId));
    return sum + (piece?.defenceBonus ?? 0);
  }, 0);

  const damage = character.baseStats.damage + (weapon?.attackValue ?? 0) + character.bonusDamage;
  const defence = character.baseStats.defence + armorDefence;

  return { damage, defence, hp: character.currentHp };
}

/** Computes the character's current max HP — the single funnel every HP-ceiling check
 * (hazard recovery, potions, the HUD) reads from, so a future max-HP-affecting mechanic
 * only needs to change this one function. */
export function computeMaxHp(character: PlayerCharacterState): number {
  return character.baseStats.hp;
}

/** Restores the character to full HP (005 FR-002), i.e. whatever `computeMaxHp` currently
 * reports. */
export function restoreToFullHp(character: PlayerCharacterState): PlayerCharacterState {
  return { ...character, currentHp: computeMaxHp(character) };
}
