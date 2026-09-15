import { positionKey, type Position } from "../types";
import type { FloorDefinition, SpikePitDefinition } from "../floor/types";

/** Returns the spike pit at a position, if any (007 US1). Mirrors hazardDamage.ts's
 * findHazardAt — spike pits reuse applyHazardDamage for their actual damage math since
 * their shape ({id, position, damage}) is identical. */
export function findSpikePitAt(
  floor: FloorDefinition,
  position: Position,
): SpikePitDefinition | undefined {
  return floor.spikePits.find((p) => positionKey(p.position) === positionKey(position));
}
