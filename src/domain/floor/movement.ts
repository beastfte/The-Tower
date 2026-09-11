import type { Position } from "../types";

export type CardinalDirection = "up" | "down" | "left" | "right";

const DELTAS: Record<CardinalDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Computes the tile one cardinal step from `from` (FR-016). There is no diagonal
 * step in this model — every move is exactly one tile in one of the four directions.
 */
export function stepInDirection(from: Position, direction: CardinalDirection): Position {
  const delta = DELTAS[direction];
  return { x: from.x + delta.x, y: from.y + delta.y };
}
