import { positionKey, type Position } from "../types";
import { resolveAttack } from "../combat/resolveAttack";
import type { HazardTileDefinition, FloorDefinition } from "../floor/types";

/** Returns the damaging-terrain hazard at a position, if any (FR-013b). */
export function findHazardAt(
  floor: FloorDefinition,
  position: Position,
): HazardTileDefinition | undefined {
  return floor.hazardTiles.find((h) => positionKey(h.position) === positionKey(position));
}

/**
 * Applies a hazard's damage to the player's current HP, reusing the same
 * damage-minus-defence formula as combat (FR-013b, contracts/combat-resolution-contract.md).
 * Unlike combat, this is not pre-blocked and can reduce HP to 0.
 */
export function applyHazardDamage(
  hazard: HazardTileDefinition,
  playerDefence: number,
  currentHp: number,
): number {
  const damageDealt = resolveAttack(
    { damage: hazard.damage, defence: 0, hp: 0 },
    { damage: 0, defence: playerDefence, hp: currentHp },
  );
  return Math.max(0, currentHp - damageDealt);
}
