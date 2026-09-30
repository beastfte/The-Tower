import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

export const FLOOR_2: FloorDefinition = {
  id: "floor-2",
  grid: [
    rowFromPattern("##.##"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("#...#"),
    rowFromPattern("##.##"),
  ],
  entrance: { x: 2, y: 13 },
  exit: { x: 2, y: 0 },
  enemies: [
    {
      "id": "floor-2-enemy-1",
      "position": {
        "x": 2,
        "y": 1
      },
      "species": "goblin",
      "stats": {
        "damage": 4,
        "defence": 1,
        "hp": 12
      },
      "isEndBoss": true
    }
  ],
  items: [],
  keyedDoors: [],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [
    {
      "id": "floor-2-lava-2",
      "position": {
        "x": 1,
        "y": 1
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-3",
      "position": {
        "x": 1,
        "y": 2
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-4",
      "position": {
        "x": 1,
        "y": 3
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-5",
      "position": {
        "x": 1,
        "y": 4
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-6",
      "position": {
        "x": 1,
        "y": 5
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-7",
      "position": {
        "x": 1,
        "y": 6
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-8",
      "position": {
        "x": 1,
        "y": 7
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-9",
      "position": {
        "x": 1,
        "y": 8
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-10",
      "position": {
        "x": 1,
        "y": 9
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-11",
      "position": {
        "x": 1,
        "y": 10
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-12",
      "position": {
        "x": 1,
        "y": 11
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-13",
      "position": {
        "x": 1,
        "y": 12
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-16",
      "position": {
        "x": 3,
        "y": 1
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-17",
      "position": {
        "x": 3,
        "y": 2
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-18",
      "position": {
        "x": 3,
        "y": 3
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-19",
      "position": {
        "x": 3,
        "y": 4
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-20",
      "position": {
        "x": 3,
        "y": 5
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-21",
      "position": {
        "x": 3,
        "y": 6
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-22",
      "position": {
        "x": 3,
        "y": 7
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-23",
      "position": {
        "x": 3,
        "y": 9
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-24",
      "position": {
        "x": 3,
        "y": 8
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-25",
      "position": {
        "x": 3,
        "y": 10
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-26",
      "position": {
        "x": 3,
        "y": 11
      },
      "damage": 8
    },
    {
      "id": "floor-2-lava-27",
      "position": {
        "x": 3,
        "y": 12
      },
      "damage": 8
    }
  ],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  zone: "ember",
  wallZoneOverrides: [],
  merchants: [],
};
