import { positionKey, type Position } from "../types";
import type { KeyedDoorDefinition, FloorDefinition } from "../floor/types";

/** Returns the keyed door at a position, if any (FR-013a). */
export function findKeyedDoorAt(
  floor: FloorDefinition,
  position: Position,
): KeyedDoorDefinition | undefined {
  return floor.keyedDoors.find((d) => positionKey(d.position) === positionKey(position));
}

/**
 * FR-013a: a keyed door is passable once the player holds a key of its matching type.
 * `heldKeyTypes` holds the key *types* the player currently has (see save.ts `keyIds`).
 */
export function isDoorPassable(
  door: KeyedDoorDefinition,
  heldKeyTypes: ReadonlySet<string>,
): boolean {
  return heldKeyTypes.has(door.doorType);
}
