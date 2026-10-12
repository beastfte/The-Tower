import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

export const FLOOR_1: FloorDefinition = {
  id: "floor-1",
  grid: [
    rowFromPattern("............."),
    rowFromPattern("##########.##"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("##.##...##.##"),
    rowFromPattern("#............"),
    rowFromPattern("##.##...##.##"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("#...##.##...#"),
    rowFromPattern("#...#...#...#"),
    rowFromPattern("#####...#####"),
  ],
  entrance: { x: 6, y: 12 },
  exit: { x: 0, y: 0 },
  enemies: [
    {
      "id": "floor-1-enemy-1",
      "position": {
        "x": 2,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-2",
      "position": {
        "x": 1,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-3",
      "position": {
        "x": 3,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-4",
      "position": {
        "x": 9,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-5",
      "position": {
        "x": 10,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-6",
      "position": {
        "x": 11,
        "y": 9
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-7",
      "position": {
        "x": 3,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-8",
      "position": {
        "x": 2,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-9",
      "position": {
        "x": 1,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-10",
      "position": {
        "x": 9,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-11",
      "position": {
        "x": 10,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-12",
      "position": {
        "x": 11,
        "y": 10
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-13",
      "position": {
        "x": 1,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-14",
      "position": {
        "x": 2,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-15",
      "position": {
        "x": 3,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-21",
      "position": {
        "x": 10,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-22",
      "position": {
        "x": 9,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-23",
      "position": {
        "x": 11,
        "y": 3
      },
      "species": "bat"
    },
    {
      "id": "floor-1-enemy-24",
      "position": {
        "x": 5,
        "y": 3
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-25",
      "position": {
        "x": 6,
        "y": 3
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-26",
      "position": {
        "x": 7,
        "y": 3
      },
      "species": "slime"
    },
    {
      "id": "floor-1-enemy-27",
      "position": {
        "x": 2,
        "y": 5
      },
      "species": "goblin"
    },
    {
      "id": "floor-1-enemy-28",
      "position": {
        "x": 10,
        "y": 5
      },
      "species": "goblin"
    }
  ],
  items: [
    {
      "id": "floor-1-item-1",
      "position": {
        "x": 5,
        "y": 11
      },
      "kind": "key",
      "payload": {
        "id": "key-bronze",
        "keyType": "bronze"
      }
    },
    {
      "id": "floor-1-item-2",
      "position": {
        "x": 7,
        "y": 11
      },
      "kind": "key",
      "payload": {
        "id": "key-bronze",
        "keyType": "bronze"
      }
    },
    {
      "id": "floor-1-item-3",
      "position": {
        "x": 5,
        "y": 12
      },
      "kind": "potion",
      "payload": undefined
    },
    {
      "id": "floor-1-item-4",
      "position": {
        "x": 7,
        "y": 12
      },
      "kind": "potion",
      "payload": undefined
    },
    {
      "id": "floor-1-item-5",
      "position": {
        "x": 2,
        "y": 11
      },
      "kind": "potionAttack",
      "payload": undefined
    },
    {
      "id": "floor-1-item-6",
      "position": {
        "x": 10,
        "y": 11
      },
      "kind": "potionDefense",
      "payload": undefined
    },
    {
      "id": "floor-1-item-10",
      "position": {
        "x": 11,
        "y": 11
      },
      "kind": "currency",
      "payload": 5
    },
    {
      "id": "floor-1-item-11",
      "position": {
        "x": 9,
        "y": 11
      },
      "kind": "currency",
      "payload": 5
    },
    {
      "id": "floor-1-item-12",
      "position": {
        "x": 3,
        "y": 11
      },
      "kind": "currency",
      "payload": 5
    },
    {
      "id": "floor-1-item-13",
      "position": {
        "x": 1,
        "y": 11
      },
      "kind": "currency",
      "payload": 5
    },
    {
      "id": "floor-1-item-19",
      "position": {
        "x": 2,
        "y": 2
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "chest"
      }
    },
    {
      "id": "floor-1-item-20",
      "position": {
        "x": 10,
        "y": 2
      },
      "kind": "weapon",
      "payload": "woodSword"
    },
    {
      "id": "floor-1-item-21",
      "position": {
        "x": 9,
        "y": 2
      },
      "kind": "potion",
      "payload": undefined
    },
    {
      "id": "floor-1-item-22",
      "position": {
        "x": 11,
        "y": 2
      },
      "kind": "potion",
      "payload": undefined
    },
    {
      "id": "floor-1-item-23",
      "position": {
        "x": 1,
        "y": 5
      },
      "kind": "key",
      "payload": {
        "id": "key-bronze",
        "keyType": "bronze"
      }
    },
    {
      "id": "floor-1-item-24",
      "position": {
        "x": 1,
        "y": 2
      },
      "kind": "currency",
      "payload": 10
    },
    {
      "id": "floor-1-item-25",
      "position": {
        "x": 3,
        "y": 2
      },
      "kind": "currency",
      "payload": 10
    }
  ],
  keyedDoors: [
    {
      "id": "floor-1-door-2",
      "position": {
        "x": 2,
        "y": 8
      },
      "doorType": "bronze"
    },
    {
      "id": "floor-1-door-3",
      "position": {
        "x": 10,
        "y": 8
      },
      "doorType": "bronze"
    },
    {
      "id": "floor-1-door-4",
      "position": {
        "x": 10,
        "y": 1
      },
      "doorType": "bronze"
    }
  ],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  zone: "stone",
  wallZoneOverrides: [],
  merchants: [
    {
      "id": "floor-1-merchant-1",
      "position": {
        "x": 6,
        "y": 2
      }
    }
  ],
};
