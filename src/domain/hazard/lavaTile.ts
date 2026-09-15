import { positionKey, type Position } from "../types";
import type { FloorDefinition, LavaTileDefinition } from "../floor/types";

/** Returns the lava tile at a position, if any (007 US2). Mirrors hazardDamage.ts's
 * findHazardAt — lava reuses applyHazardDamage for its damage math ({id, position, damage}). */
export function findLavaTileAt(
  floor: FloorDefinition,
  position: Position,
): LavaTileDefinition | undefined {
  return floor.lavaTiles.find((l) => positionKey(l.position) === positionKey(position));
}
