import type { PlayerSave } from "../character/save";

/** FR-013c: hazard damage bringing HP to 0 triggers the death state. */
export function hasDiedFromHazard(currentHp: number): boolean {
  return currentHp <= 0;
}

/** Marks the save as dead — the death screen is shown while this is true. */
export function markDead(save: PlayerSave): PlayerSave {
  return { ...save, isDead: true, character: { ...save.character, currentHp: 0 } };
}
