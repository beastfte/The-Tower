import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

export const FLOOR_1: FloorDefinition = {
  id: "floor-1",
  grid: [
    rowFromPattern("######.######"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("#...........#"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("######.######"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("#...........#"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("######.######"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("#...........#"),
    rowFromPattern("#....#.#....#"),
    rowFromPattern("######.######"),
  ],
  entrance: { x: 6, y: 12 },
  exit: { x: 6, y: 0 },
  enemies: [
    {
      "id": "floor-1-enemy-1",
      "position": {
        "x": 4,
        "y": 3
      },
      "species": "goblin",
      "stats": {
        "damage": 4,
        "defence": 1,
        "hp": 12
      }
    },
    {
      "id": "floor-1-enemy-2",
      "position": {
        "x": 3,
        "y": 3
      },
      "species": "ogre",
      "stats": {
        "damage": 6,
        "defence": 4,
        "hp": 30
      }
    },
    {
      "id": "floor-1-enemy-3",
      "position": {
        "x": 2,
        "y": 3
      },
      "species": "wizard",
      "stats": {
        "damage": 8,
        "defence": 0,
        "hp": 10
      }
    },
    {
      "id": "floor-1-enemy-4",
      "position": {
        "x": 1,
        "y": 3
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-5",
      "position": {
        "x": 1,
        "y": 2
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-6",
      "position": {
        "x": 2,
        "y": 2
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-8",
      "position": {
        "x": 3,
        "y": 2
      },
      "species": "voidwalker",
      "stats": {
        "damage": 9,
        "defence": 3,
        "hp": 20
      }
    },
    {
      "id": "floor-1-enemy-9",
      "position": {
        "x": 4,
        "y": 2
      },
      "species": "bandit",
      "stats": {
        "damage": 6,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-10",
      "position": {
        "x": 4,
        "y": 5
      },
      "species": "necromancer",
      "stats": {
        "damage": 7,
        "defence": 1,
        "hp": 12
      }
    },
    {
      "id": "floor-1-enemy-11",
      "position": {
        "x": 6,
        "y": 1
      },
      "species": "necromancer",
      "stats": {
        "damage": 7,
        "defence": 1,
        "hp": 12
      }
    },
    {
      "id": "floor-1-enemy-12",
      "position": {
        "x": 2,
        "y": 7
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-13",
      "position": {
        "x": 3,
        "y": 7
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-14",
      "position": {
        "x": 4,
        "y": 7
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-15",
      "position": {
        "x": 4,
        "y": 6
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-16",
      "position": {
        "x": 3,
        "y": 6
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-17",
      "position": {
        "x": 2,
        "y": 6
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-18",
      "position": {
        "x": 2,
        "y": 5
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-19",
      "position": {
        "x": 3,
        "y": 5
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-25",
      "position": {
        "x": 8,
        "y": 10
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-26",
      "position": {
        "x": 8,
        "y": 11
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-29",
      "position": {
        "x": 9,
        "y": 10
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-30",
      "position": {
        "x": 10,
        "y": 10
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-32",
      "position": {
        "x": 10,
        "y": 11
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-33",
      "position": {
        "x": 4,
        "y": 11
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-34",
      "position": {
        "x": 3,
        "y": 11
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-35",
      "position": {
        "x": 2,
        "y": 11
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-36",
      "position": {
        "x": 2,
        "y": 10
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-37",
      "position": {
        "x": 3,
        "y": 10
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-38",
      "position": {
        "x": 4,
        "y": 10
      },
      "species": "slime",
      "stats": {
        "damage": 2,
        "defence": 2,
        "hp": 14
      }
    },
    {
      "id": "floor-1-enemy-39",
      "position": {
        "x": 9,
        "y": 11
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-40",
      "position": {
        "x": 8,
        "y": 7
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-41",
      "position": {
        "x": 9,
        "y": 7
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-42",
      "position": {
        "x": 10,
        "y": 7
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-43",
      "position": {
        "x": 10,
        "y": 6
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-44",
      "position": {
        "x": 9,
        "y": 6
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-45",
      "position": {
        "x": 8,
        "y": 6
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-46",
      "position": {
        "x": 8,
        "y": 5
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-47",
      "position": {
        "x": 9,
        "y": 5
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-48",
      "position": {
        "x": 10,
        "y": 5
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-49",
      "position": {
        "x": 11,
        "y": 5
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-50",
      "position": {
        "x": 11,
        "y": 7
      },
      "species": "skeleton",
      "stats": {
        "damage": 5,
        "defence": 2,
        "hp": 16
      }
    },
    {
      "id": "floor-1-enemy-51",
      "position": {
        "x": 1,
        "y": 5
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    },
    {
      "id": "floor-1-enemy-52",
      "position": {
        "x": 1,
        "y": 7
      },
      "species": "bat",
      "stats": {
        "damage": 3,
        "defence": 0,
        "hp": 6
      }
    }
  ],
  items: [
    {
      "id": "floor-1-item-1",
      "position": {
        "x": 1,
        "y": 9
      },
      "kind": "potionAttack",
      "payload": undefined
    },
    {
      "id": "floor-1-item-2",
      "position": {
        "x": 1,
        "y": 10
      },
      "kind": "potionAttack",
      "payload": undefined
    },
    {
      "id": "floor-1-item-3",
      "position": {
        "x": 1,
        "y": 11
      },
      "kind": "potionAttack",
      "payload": undefined
    },
    {
      "id": "floor-1-item-4",
      "position": {
        "x": 11,
        "y": 9
      },
      "kind": "potionDefense",
      "payload": undefined
    },
    {
      "id": "floor-1-item-5",
      "position": {
        "x": 11,
        "y": 11
      },
      "kind": "potionDefense",
      "payload": undefined
    },
    {
      "id": "floor-1-item-6",
      "position": {
        "x": 11,
        "y": 10
      },
      "kind": "potionDefense",
      "payload": undefined
    },
    {
      "id": "floor-1-item-8",
      "position": {
        "x": 1,
        "y": 6
      },
      "kind": "weapon",
      "payload": "woodSword"
    },
    {
      "id": "floor-1-item-10",
      "position": {
        "x": 1,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "helm"
      }
    },
    {
      "id": "floor-1-item-11",
      "position": {
        "x": 2,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "chest"
      }
    },
    {
      "id": "floor-1-item-12",
      "position": {
        "x": 3,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "legs"
      }
    },
    {
      "id": "floor-1-item-13",
      "position": {
        "x": 4,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "boots"
      }
    },
    {
      "id": "floor-1-item-14",
      "position": {
        "x": 8,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "plate",
        "slot": "boots"
      }
    },
    {
      "id": "floor-1-item-15",
      "position": {
        "x": 9,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "plate",
        "slot": "legs"
      }
    },
    {
      "id": "floor-1-item-16",
      "position": {
        "x": 10,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "plate",
        "slot": "chest"
      }
    },
    {
      "id": "floor-1-item-17",
      "position": {
        "x": 11,
        "y": 1
      },
      "kind": "armor",
      "payload": {
        "material": "plate",
        "slot": "helm"
      }
    },
    {
      "id": "floor-1-item-34",
      "position": {
        "x": 11,
        "y": 3
      },
      "kind": "armor",
      "payload": {
        "material": "mail",
        "slot": "helm"
      }
    },
    {
      "id": "floor-1-item-35",
      "position": {
        "x": 10,
        "y": 3
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "chest"
      }
    },
    {
      "id": "floor-1-item-36",
      "position": {
        "x": 9,
        "y": 3
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "legs"
      }
    },
    {
      "id": "floor-1-item-37",
      "position": {
        "x": 8,
        "y": 3
      },
      "kind": "armor",
      "payload": {
        "material": "leather",
        "slot": "boots"
      }
    },
    {
      "id": "floor-1-item-38",
      "position": {
        "x": 4,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-gold",
        "keyType": "gold"
      }
    },
    {
      "id": "floor-1-item-39",
      "position": {
        "x": 3,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-silver",
        "keyType": "silver"
      }
    },
    {
      "id": "floor-1-item-40",
      "position": {
        "x": 2,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-bronze",
        "keyType": "bronze"
      }
    },
    {
      "id": "floor-1-item-42",
      "position": {
        "x": 9,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-silver",
        "keyType": "silver"
      }
    },
    {
      "id": "floor-1-item-44",
      "position": {
        "x": 8,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-gold",
        "keyType": "gold"
      }
    },
    {
      "id": "floor-1-item-45",
      "position": {
        "x": 10,
        "y": 9
      },
      "kind": "key",
      "payload": {
        "id": "key-bronze",
        "keyType": "bronze"
      }
    }
  ],
  keyedDoors: [
    {
      "id": "floor-1-door-1",
      "position": {
        "x": 5,
        "y": 6
      },
      "doorType": "bronze"
    },
    {
      "id": "floor-1-door-2",
      "position": {
        "x": 7,
        "y": 6
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
      "id": "floor-1-merchant-2",
      "position": {
        "x": 11,
        "y": 6
      }
    }
  ],
};
