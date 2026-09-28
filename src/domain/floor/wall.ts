import { positionKey, type Position } from "../types";
import type { CrackedWallDefinition, FloorDefinition, ZoneThemeId } from "./types";

/** 013 FR-004: "more than five" collisions before a cracked wall opens. */
export const CRACKED_WALL_BREAK_THRESHOLD = 5;

/** Returns the cracked wall at a position, if any (013). */
export function findCrackedWallAt(
  floor: FloorDefinition,
  position: Position,
): CrackedWallDefinition | undefined {
  return floor.crackedWalls.find((w) => positionKey(w.position) === positionKey(position));
}

/** Returns the zone a wall tile at `position` should render with — its per-tile override if
 * one exists, otherwise the floor's own zone (013 session 3). */
export function resolveWallZone(floor: FloorDefinition, position: Position): ZoneThemeId {
  const override = floor.wallZoneOverrides.find((o) => positionKey(o.position) === positionKey(position));
  return override?.zone ?? floor.zone ?? "stone";
}

/** hitCount > CRACKED_WALL_BREAK_THRESHOLD, i.e. "more than five" collisions (FR-004). */
export function isWallBroken(hitCount: number): boolean {
  return hitCount > CRACKED_WALL_BREAK_THRESHOLD;
}

/** Every crackedWalls position whose current hit count makes it broken — the set attemptMove
 * and redraw() both treat as walkable, mirroring resolveLeverEffects's shape (data-model.md). */
export function resolveBrokenWallPositions(
  floor: FloorDefinition,
  crackedWallHitCounts: Record<string, number>,
): Position[] {
  return floor.crackedWalls
    .filter((wall) => isWallBroken(crackedWallHitCounts[wall.id] ?? 0))
    .map((wall) => wall.position);
}
