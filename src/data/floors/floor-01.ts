import type { FloorDefinition } from "../../domain/floor/types";
import { W, wallRow, corridorRow } from "./gridHelpers";

function rowWithOpenings(...xs: number[]): (typeof W)[] {
  const row = wallRow();
  for (const x of xs) row[x] = W;
  return row;
}

/**
 * Floor 1 — a single main corridor (y=10) with small dead-end alcoves branching off it.
 * Resized to the 20x20 tile baseline (FR-002a) while preserving every relative position
 * (entrance/exit, enemy/item/door/hazard placements) the original 10x5 layout used, since
 * tests/e2e/floorPlay.spec.ts drives a fixed sequence of relative moves through this floor.
 *
 * Layout (x: 0-19, y: 0-19):
 *   y0-8: wall rows
 *   y9: wall except (5,9) key alcove and (8,9) loot alcove
 *   y10: main corridor, fully walkable — entrance (0,10) to exit (19,10)
 *   y11: wall except (1,11) optional-enemy alcove
 *   y12-19: wall rows
 *
 * Compulsory enemy at (3,10) and the keyed door at (6,10) sit on the corridor itself,
 * so there is no way around them (satisfies floor-data-contract invariant 3); the
 * alcoves are dead ends off the corridor, so the optional enemy never blocks the
 * only path to the exit (invariant 2 / acceptance scenario 4).
 */
export const FLOOR_01: FloorDefinition = {
  id: "floor-01",
  grid: [
    ...Array.from({ length: 9 }, () => wallRow()),
    rowWithOpenings(5, 8),
    corridorRow(),
    rowWithOpenings(1),
    ...Array.from({ length: 8 }, () => wallRow()),
  ],
  entrance: { x: 0, y: 10 },
  exit: { x: 19, y: 10 },
  enemies: [
    {
      id: "floor01-goblin",
      position: { x: 3, y: 10 },
      stats: { damage: 4, defence: 1, hp: 12 },
      placement: "compulsory",
      drops: { currency: 15 },
    },
    {
      id: "floor01-rat",
      position: { x: 1, y: 11 },
      stats: { damage: 3, defence: 0, hp: 10 },
      placement: "optional",
      drops: {
        powerup: {
          id: "power-glove",
          statBonus: { damage: 5 },
          description: "A worn leather glove that hits harder.",
        },
      },
    },
  ],
  items: [
    {
      id: "floor01-key-bronze",
      position: { x: 5, y: 9 },
      kind: "key",
      payload: { id: "key-bronze", keyType: "bronze" },
    },
    {
      id: "floor01-loot-torch",
      position: { x: 8, y: 9 },
      kind: "loot",
      payload: { id: "loot-torch", name: "Rusty Torch" },
    },
    {
      id: "floor01-gold-pile",
      position: { x: 7, y: 10 },
      kind: "currency",
      payload: 10,
    },
  ],
  keyedDoors: [{ id: "floor01-door-bronze", position: { x: 6, y: 10 }, doorType: "bronze" }],
  hazardTiles: [{ id: "floor01-lava", position: { x: 4, y: 10 }, damage: 8 }],
};
