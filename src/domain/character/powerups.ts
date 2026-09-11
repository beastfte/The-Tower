import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "./save";
import type { PowerupDefinition } from "./types";

/**
 * Computes the player's effective combat stats: base stats plus every collected
 * powerup's stat bonus (FR-008). `hp` reflects the character's current HP (a real,
 * persistent resource, research.md #6), not max HP.
 */
export function computeEffectiveStats(
  character: PlayerCharacterState,
  powerupCatalog: ReadonlyMap<string, PowerupDefinition>,
): CombatStats {
  let damage = character.baseStats.damage;
  let defence = character.baseStats.defence;

  for (const id of character.powerupIds) {
    const powerup = powerupCatalog.get(id);
    if (!powerup) continue;
    damage += powerup.statBonus.damage ?? 0;
    defence += powerup.statBonus.defence ?? 0;
  }

  return { damage, defence, hp: character.currentHp };
}

/** Computes the character's current max HP: base HP plus every collected powerup's HP bonus. */
export function computeMaxHp(
  character: PlayerCharacterState,
  powerupCatalog: ReadonlyMap<string, PowerupDefinition>,
): number {
  let maxHp = character.baseStats.hp;
  for (const id of character.powerupIds) {
    const powerup = powerupCatalog.get(id);
    if (!powerup) continue;
    maxHp += powerup.statBonus.hp ?? 0;
  }
  return maxHp;
}

/**
 * Applies a collected powerup to the character (FR-008): records it as acquired and,
 * if it grants a max-HP bonus, immediately heals the character by that same amount
 * (consistent with the bonus taking effect right away).
 */
export function applyPowerup(
  character: PlayerCharacterState,
  powerup: PowerupDefinition,
): PlayerCharacterState {
  if (character.powerupIds.includes(powerup.id)) return character;
  return {
    ...character,
    powerupIds: [...character.powerupIds, powerup.id],
    currentHp: character.currentHp + (powerup.statBonus.hp ?? 0),
  };
}
