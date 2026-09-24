import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

/**
 * The tower's final floor: entrance, boss, and exit stay at their original single-corridor
 * shape (a solid-walled boss column with the boss as its only opening), resized to the 15x15
 * baseline (014 FR-001) from the previous 20x20 grid. The boss's column (x=7) is solid-walled
 * at every row except the boss's own row (y=7), so it remains the only opening between the
 * two rooms and no route to the exit can bypass it (floor-data-contract invariant 3,
 * unchanged). 014 drops the old bottom dead-end alcove (not enough room left in 15x15) and
 * relocates all four existing items directly into the two main rooms, off the boss's own row
 * (FR-002/FR-009) — an armor pickup and a weapon pickup on the left, a potion and a chest on
 * the right, mirroring the original left/right split.
 */
export const FLOOR_FINAL: FloorDefinition = {
  id: "floor-final",
  grid: [
    rowFromPattern("###############"),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern("..............."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern(".......#......."),
    rowFromPattern("###############"),
  ],
  entrance: { x: 0, y: 7 },
  exit: { x: 14, y: 7 },
  enemies: [
    {
      id: "floor-final-boss",
      position: { x: 7, y: 7 },
      species: "ogre",
      stats: { damage: 5, defence: 3, hp: 25 },
      isEndBoss: true,
      drops: { currency: 100 },
    },
  ],
  items: [
    {
      id: "floor-final-armor-mail",
      position: { x: 2, y: 3 },
      kind: "armor",
      // 011: migrated from the old whole-character "mail" tier payload to a per-slot pickup
      // (research.md #7) — chest chosen as the closest analogue to a former whole-body piece.
      payload: { material: "mail", slot: "chest" },
    },
    {
      id: "floor-final-weapon-bow",
      position: { x: 3, y: 11 },
      kind: "weapon",
      payload: "bow",
    },
    {
      id: "floor-final-potion",
      position: { x: 11, y: 3 },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor-final-chest",
      position: { x: 11, y: 11 },
      kind: "chest",
      payload: { kind: "currency", amount: 30 },
    },
  ],
  keyedDoors: [],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  torches: [],
  wallZoneOverrides: [],
};
