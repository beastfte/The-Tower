import type { FloorDefinition } from "../../domain/floor/types";

const W = { walkable: true };
const X = { walkable: false };

function wallRow(): (typeof W)[] {
  return Array(20).fill(X);
}

function corridorRow(): (typeof W)[] {
  return Array(20).fill(W);
}

/**
 * The tower's final floor: a single corridor with no alternate route, so the end
 * boss (compulsory, isEndBoss) must be defeated to reach the exit (FR-011).
 * Resized to the 20x20 tile baseline (FR-002a); the boss sits mid-corridor at (10,10).
 */
export const FLOOR_FINAL: FloorDefinition = {
  id: "floor-final",
  grid: [
    ...Array.from({ length: 10 }, () => wallRow()),
    corridorRow(),
    ...Array.from({ length: 9 }, () => wallRow()),
  ],
  entrance: { x: 0, y: 10 },
  exit: { x: 19, y: 10 },
  enemies: [
    {
      id: "floor-final-boss",
      position: { x: 10, y: 10 },
      stats: { damage: 5, defence: 3, hp: 25 },
      placement: "compulsory",
      isEndBoss: true,
      drops: { currency: 100 },
    },
  ],
  items: [],
  keyedDoors: [],
  hazardTiles: [],
};
