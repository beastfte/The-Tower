import type { Position } from "../types";
import { positionKey } from "../types";
import type { FloorDefinition } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function inBounds(floor: FloorDefinition, p: Position): boolean {
  const row = floor.grid[p.y];
  return row !== undefined && row[p.x] !== undefined;
}

function tileWalkable(floor: FloorDefinition, p: Position): boolean {
  return inBounds(floor, p) && floor.grid[p.y]![p.x]!.walkable;
}

/** BFS from entrance to exit assuming every compulsory enemy is defeated and every keyed door open. */
function fullyClearedPathExists(floor: FloorDefinition): boolean {
  const optionalBlocked = new Set(
    floor.enemies.filter((e) => e.placement === "optional").map((e) => positionKey(e.position)),
  );
  return bfsReaches(floor, floor.entrance, floor.exit, optionalBlocked);
}

/** BFS treating only compulsory-enemy tiles and keyed-door tiles as blocked — the gates
 * invariant 3 requires to be mandatory (optional enemies are deliberately excluded here:
 * this check isolates whether the compulsory/door gates themselves are bypassable). */
function bypassesEveryGate(floor: FloorDefinition): boolean {
  const gatesBlocked = new Set([
    ...floor.enemies
      .filter((e) => e.placement === "compulsory")
      .map((e) => positionKey(e.position)),
    ...floor.keyedDoors.map((d) => positionKey(d.position)),
  ]);
  return bfsReaches(floor, floor.entrance, floor.exit, gatesBlocked);
}

function bfsReaches(
  floor: FloorDefinition,
  start: Position,
  goal: Position,
  extraBlocked: Set<string>,
): boolean {
  const visited = new Set<string>([positionKey(start)]);
  const queue: Position[] = [start];
  const deltas = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (positionKey(current) === positionKey(goal)) return true;
    for (const d of deltas) {
      const next: Position = { x: current.x + d.x, y: current.y + d.y };
      const key = positionKey(next);
      if (visited.has(key)) continue;
      if (!inBounds(floor, next)) continue;
      if (!tileWalkable(floor, next)) continue;
      if (extraBlocked.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** Validates a single FloorDefinition against invariants 1-4, 6, and 8 of contracts/floor-data-contract.md. */
export function validateFloorDefinition(floor: FloorDefinition): ValidationResult {
  const errors: string[] = [];

  const occupied = new Map<string, string>();
  const claim = (p: Position, label: string) => {
    const key = positionKey(p);
    const existing = occupied.get(key);
    if (existing) {
      errors.push(
        `Floor "${floor.id}": tile ${key} is claimed by both ${existing} and ${label} (invariant 6)`,
      );
    } else {
      occupied.set(key, label);
    }
  };

  // Invariant 1: entrance/exit walkable and unoccupied.
  if (!tileWalkable(floor, floor.entrance)) {
    errors.push(`Floor "${floor.id}": entrance is not on a walkable tile (invariant 1)`);
  }
  if (!tileWalkable(floor, floor.exit)) {
    errors.push(`Floor "${floor.id}": exit is not on a walkable tile (invariant 1)`);
  }

  for (const enemy of floor.enemies) claim(enemy.position, `enemy "${enemy.id}"`);
  for (const item of floor.items) claim(item.position, `item "${item.id}"`);
  for (const door of floor.keyedDoors) claim(door.position, `keyed door "${door.id}"`);
  for (const hazard of floor.hazardTiles) claim(hazard.position, `hazard "${hazard.id}"`);

  if (occupied.has(positionKey(floor.entrance))) {
    errors.push(`Floor "${floor.id}": entrance tile coincides with occupied content (invariant 1)`);
  }
  if (occupied.has(positionKey(floor.exit))) {
    errors.push(`Floor "${floor.id}": exit tile coincides with occupied content (invariant 1)`);
  }

  // Invariant 4: id uniqueness within each scope.
  const checkUnique = (ids: string[], scope: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        errors.push(`Floor "${floor.id}": duplicate ${scope} id "${id}" (invariant 4)`);
      }
      seen.add(id);
    }
  };
  checkUnique(
    floor.enemies.map((e) => e.id),
    "enemy",
  );
  checkUnique(
    floor.items.map((i) => i.id),
    "item",
  );
  checkUnique(
    floor.keyedDoors.map((d) => d.id),
    "keyed door",
  );
  checkUnique(
    floor.hazardTiles.map((h) => h.id),
    "hazard",
  );

  // Invariant 2: the fully-cleared, fully-keyed floor is always completable.
  if (!fullyClearedPathExists(floor)) {
    errors.push(
      `Floor "${floor.id}": no path from entrance to exit even when fully cleared/keyed (invariant 2)`,
    );
  }

  // Invariant 3: compulsory enemies / keyed doors on the critical path are never bypassable.
  if (bypassesEveryGate(floor)) {
    errors.push(
      `Floor "${floor.id}": a path to the exit exists that bypasses every compulsory enemy and keyed door (invariant 3)`,
    );
  }

  // Invariant 8: grid is at least 20x20 tiles going forward (FR-002a).
  const height = floor.grid.length;
  const width = floor.grid[0]?.length ?? 0;
  if (height < 20 || width < 20) {
    errors.push(
      `Floor "${floor.id}": grid must be at least 20x20 tiles, got ${width}x${height} (invariant 8, FR-002a)`,
    );
  }

  return { valid: errors.length === 0, errors };
}
