import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

/**
 * The tower's final floor: entrance, boss, and exit stay at their original single-corridor
 * positions ((0,10), (10,10), (19,10)), but each side of the boss is now an open, explorable
 * room rather than a single corridor (FR-015). The boss's column is solid-walled at every
 * other row, so it remains the only opening between the two rooms and no route to the exit
 * can bypass it (floor-data-contract invariant 3, unchanged). One dead-end alcove holds a
 * weapon pickup; an armor pickup sits in the entry room (FR-012). Walkable area is 239 tiles
 * across a 20x20 grid (FR-015, ≥15x15). 005 adds a health potion and a treasure chest
 * (currency reward) to the exit-side room, reachable without affecting the boss chokepoint
 * (FR-009).
 */
export const FLOOR_FINAL: FloorDefinition = {
  id: "floor-final",
  grid: [
    rowFromPattern("####################"),
    rowFromPattern("####################"),
    rowFromPattern("####################"),
    rowFromPattern("####################"),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("...................."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("..........#........."),
    rowFromPattern("####.###############"),
    rowFromPattern("###...##############"),
    rowFromPattern("###...##############"),
    rowFromPattern("###...##############"),
  ],
  entrance: { x: 0, y: 10 },
  exit: { x: 19, y: 10 },
  enemies: [
    {
      id: "floor-final-boss",
      position: { x: 10, y: 10 },
      species: "ogre",
      stats: { damage: 5, defence: 3, hp: 25 },
      placement: "compulsory",
      isEndBoss: true,
      drops: { currency: 100 },
    },
  ],
  items: [
    {
      id: "floor-final-weapon-bow",
      position: { x: 4, y: 18 },
      kind: "weapon",
      payload: "bow",
    },
    {
      id: "floor-final-armor-mail",
      position: { x: 2, y: 8 },
      kind: "armor",
      // 011: migrated from the old whole-character "mail" tier payload to a per-slot pickup
      // (research.md #7) — chest chosen as the closest analogue to a former whole-body piece.
      payload: { material: "mail", slot: "chest" },
    },
    {
      id: "floor-final-potion",
      position: { x: 15, y: 6 },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor-final-chest",
      position: { x: 15, y: 13 },
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
