import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "./save";
import type { ArmorTierDefinition, ArmorTierId, WeaponDefinition, WeaponId } from "./types";

/**
 * Computes the player's effective combat stats: an equipped weapon replaces base
 * damage (FR-005), an equipped armor tier adds to base defence (FR-008). `hp`
 * reflects the character's current HP (a real, persistent resource, research.md #6),
 * not max HP.
 */
export function computeEffectiveStats(
  character: PlayerCharacterState,
  weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition>,
  armorTierCatalog: ReadonlyMap<ArmorTierId, ArmorTierDefinition>,
): CombatStats {
  const weapon = character.equippedWeaponId ? weaponCatalog.get(character.equippedWeaponId) : undefined;
  const armorTier = character.equippedArmorTier ? armorTierCatalog.get(character.equippedArmorTier) : undefined;

  const damage = weapon?.attackValue ?? character.baseStats.damage;
  const defence = character.baseStats.defence + (armorTier?.defenceBonus ?? 0);

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
