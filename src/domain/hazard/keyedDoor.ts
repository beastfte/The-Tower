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
 * 007 US3 (FR-009): also passable once a lever's `unlockDoor` effect has permanently
 * targeted this door — `unlockedDoorIds` comes from `resolveLeverEffects`.
 * 010 US1 (FR-002): also passable once the door has been permanently opened
 * (`openedDoorIds`, from `FloorProgress`) — independent of whether the key that opened it
 * is still held, since opening a door consumes its key (`applyDoorOpen`). This is what keeps
 * a door passable on a second visit after its key is gone: the *first* visit is passable via
 * `heldKeyTypes`, which is what lets the caller (FloorScene's attemptMove) allow the step and
 * then call `applyDoorOpen`; every visit after that is passable via `openedDoorIds` alone.
 */
export function isDoorPassable(
  door: KeyedDoorDefinition,
  heldKeyTypes: ReadonlySet<string>,
  unlockedDoorIds: ReadonlySet<string> = new Set(),
  openedDoorIds: ReadonlySet<string> = new Set(),
): boolean {
  return openedDoorIds.has(door.id) || heldKeyTypes.has(door.doorType) || unlockedDoorIds.has(door.id);
}
