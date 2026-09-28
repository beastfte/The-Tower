import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

export const FLOOR_2: FloorDefinition = {
  id: "floor-2",
  grid: [
    rowFromPattern("......#.#......"),
    rowFromPattern("......#.#......"),
    rowFromPattern("......#.#......"),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
    rowFromPattern("..............."),
  ],
  entrance: { x: 7, y: 14 },
  exit: { x: 7, y: 0 },
  enemies: [
    {
      id: "floor-2-enemy-3",
      position: {
        x: 7,
        y: 1,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
      isEndBoss: true,
    },
    {
      id: "floor-2-enemy-7",
      position: {
        x: 7,
        y: 2,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-2-enemy-10",
      position: {
        x: 7,
        y: 3,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-2-enemy-11",
      position: {
        x: 5,
        y: 1,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-2-enemy-12",
      position: {
        x: 9,
        y: 1,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-2-enemy-13",
      position: {
        x: 5,
        y: 0,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-2-enemy-14",
      position: {
        x: 9,
        y: 0,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
  ],
  items: [],
  keyedDoors: [],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  torches: [],
  zone: "ember",
  wallZoneOverrides: [],
};
