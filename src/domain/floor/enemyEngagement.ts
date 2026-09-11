import { positionKey, type Position } from "../types";
import type { EnemyDefinition, FloorDefinition } from "./types";

/** Returns the living (not-yet-defeated) enemy at a position, if any. */
export function findLivingEnemyAt(
  floor: FloorDefinition,
  position: Position,
  defeatedEnemyIds: ReadonlySet<string>,
): EnemyDefinition | undefined {
  return floor.enemies.find(
    (e) => positionKey(e.position) === positionKey(position) && !defeatedEnemyIds.has(e.id),
  );
}
