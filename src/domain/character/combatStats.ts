import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "./save";
import type { ArmorPieceDefinition, ArmorSlotId, WeaponDefinition, WeaponId } from "./types";
import { armorPieceKey } from "../../data/armorPieces";

/**
 * Computes the player's effective combat stats: an equipped weapon replaces base
 * damage (FR-005), each independently-equipped armor slot adds its own defence value
 * (011 FR-003 — sum across slots, not one whole-character tier), and any Attack Potion
 * bonus (`bonusDamage`, 011 FR-007) always adds on top of whichever damage source is
 * active, since a weapon *replaces* rather than adds to `baseStats.damage`. `hp`
 * reflects the character's current HP (a real, persistent resource, research.md #6),
 * not max HP.
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

  const damage = (weapon?.attackValue ?? character.baseStats.damage) + character.bonusDamage;
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
