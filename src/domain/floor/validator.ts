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

/** Every position a `revealPathway` lever effect would open up, keyed for BFS lookups. */
function allRevealedPathwayPositions(floor: FloorDefinition, excludeLeverId?: string): Set<string> {
  const positions = new Set<string>();
  for (const lever of floor.levers) {
    if (lever.id === excludeLeverId) continue;
    if (lever.effect.kind === "revealPathway") positions.add(positionKey(lever.effect.position));
  }
  return positions;
}

/** BFS from entrance to exit assuming every compulsory enemy is defeated, every keyed door
 * open, and every lever-revealed pathway open (007 US3, contract invariant 14 — a fully
 * progressed player can pass every optional gate, levers included). */
function fullyClearedPathExists(floor: FloorDefinition): boolean {
  const optionalBlocked = new Set(
    floor.enemies.filter((e) => e.placement === "optional").map((e) => positionKey(e.position)),
  );
  return bfsReaches(floor, floor.entrance, floor.exit, optionalBlocked, allRevealedPathwayPositions(floor));
}

/** 007 US3 (contract invariant 12): no lever may be the sole means of reaching itself.
 * Returns the ids of any lever unreachable from the entrance once every *other* lever's
 * pathway is assumed open (its own pathway is excluded, so a lever can't bootstrap its own
 * access), matching invariant 2's "fully progressed player" baseline (optional enemies
 * cleared, doors keyed — neither is a self-referential dependency). */
function leverIdsWithSelfCycle(floor: FloorDefinition): string[] {
  const optionalBlocked = new Set(
    floor.enemies.filter((e) => e.placement === "optional").map((e) => positionKey(e.position)),
  );
  const badIds: string[] = [];
  for (const lever of floor.levers) {
    const reachable = bfsReaches(
      floor,
      floor.entrance,
      lever.position,
      optionalBlocked,
      allRevealedPathwayPositions(floor, lever.id),
    );
    if (!reachable) badIds.push(lever.id);
  }
  return badIds;
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
  extraWalkable: Set<string> = new Set(),
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
      if (!tileWalkable(floor, next) && !extraWalkable.has(key)) continue;
      if (extraBlocked.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** 007 US3 (contract invariant 11): validates every lever's effect references something that
 * actually exists on this floor, and that a `revealPathway` target is a non-walkable,
 * unclaimed tile. `occupied` is the same claim-map `validateFloorDefinition` builds for
 * invariant 6, reused here since a pathway target must not collide with placed content. */
function validateLeverEffects(
  floor: FloorDefinition,
  occupied: Map<string, string>,
  errors: string[],
): void {
  const doorIds = new Set(floor.keyedDoors.map((d) => d.id));
  const trapIds = new Set([...floor.spikePits.map((p) => p.id), ...floor.lavaTiles.map((l) => l.id)]);

  for (const lever of floor.levers) {
    const effect = lever.effect;
    if (effect.kind === "unlockDoor") {
      if (!doorIds.has(effect.doorId)) {
        errors.push(
          `Floor "${floor.id}": lever "${lever.id}" targets unknown door "${effect.doorId}" (invariant 11)`,
        );
      }
    } else if (effect.kind === "deactivateTraps") {
      for (const targetId of effect.targetIds) {
        if (!trapIds.has(targetId)) {
          errors.push(
            `Floor "${floor.id}": lever "${lever.id}" targets unknown spike pit/lava tile "${targetId}" (invariant 11)`,
          );
        }
      }
    } else {
      if (tileWalkable(floor, effect.position)) {
        errors.push(
          `Floor "${floor.id}": lever "${lever.id}"'s revealed pathway at ${positionKey(effect.position)} is already walkable (invariant 11)`,
        );
      }
      if (occupied.has(positionKey(effect.position))) {
        errors.push(
          `Floor "${floor.id}": lever "${lever.id}"'s revealed pathway at ${positionKey(effect.position)} coincides with other placed content (invariant 11)`,
        );
      }
    }
  }
}

/** Validates a single FloorDefinition against invariants 1-4, 6, 8-9, and 11-12 of
 * contracts/floor-data-contract.md and contracts/trap-mechanics-contract.md. */
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
  for (const pit of floor.spikePits) claim(pit.position, `spike pit "${pit.id}"`);
  for (const lava of floor.lavaTiles) claim(lava.position, `lava tile "${lava.id}"`);
  for (const lever of floor.levers) claim(lever.position, `lever "${lever.id}"`);
  for (const water of floor.waterTiles) claim(water.position, `water tile "${water.id}"`);

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
  checkUnique(
    floor.spikePits.map((p) => p.id),
    "spike pit",
  );
  checkUnique(
    floor.lavaTiles.map((l) => l.id),
    "lava tile",
  );
  checkUnique(
    floor.levers.map((l) => l.id),
    "lever",
  );
  checkUnique(
    floor.waterTiles.map((w) => w.id),
    "water tile",
  );

  // 007 US4 (contract invariant 10): a water tile's grid cell must be non-walkable — its
  // only gameplay behavior is blocking, which the grid already expresses (research.md #8).
  for (const water of floor.waterTiles) {
    if (tileWalkable(floor, water.position)) {
      errors.push(
        `Floor "${floor.id}": water tile "${water.id}" at ${positionKey(water.position)} must be on a non-walkable grid cell (invariant 10)`,
      );
    }
  }

  // 007 US3 (contract invariant 11): every LeverEffect reference must resolve on this floor.
  validateLeverEffects(floor, occupied, errors);

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

  // 007 US3 (contract invariant 12): no lever may gate the only route to itself.
  for (const leverId of leverIdsWithSelfCycle(floor)) {
    errors.push(
      `Floor "${floor.id}": lever "${leverId}" is not reachable without its own effect (invariant 12)`,
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
