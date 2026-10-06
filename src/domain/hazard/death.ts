import type { PlayerSave } from "../character/save";

/** FR-013c: hazard damage bringing HP to 0 triggers the death state. */
export function hasDiedFromHazard(currentHp: number): boolean {
  return currentHp <= 0;
}

/** Marks the save as dead — the death screen is shown while this is true. 027 FR-028: `cause`
 * is the killing monster's display name for a combat death; trap deaths pass nothing. */
export function markDead(save: PlayerSave, cause?: string): PlayerSave {
  const dead: PlayerSave = { ...save, isDead: true, character: { ...save.character, currentHp: 0 } };
  if (cause) dead.deathCause = cause;
  else delete dead.deathCause;
  return dead;
}
