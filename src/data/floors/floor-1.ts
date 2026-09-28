import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

export const FLOOR_1: FloorDefinition = {
  id: "floor-1",
  grid: [
    rowFromPattern("#######.#######"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("#.............#"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("######...######"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("####.......####"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("######...######"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("#.............#"),
    rowFromPattern("#....#...#....#"),
    rowFromPattern("#######.#######"),
  ],
  entrance: { x: 7, y: 14 },
  exit: { x: 7, y: 0 },
  enemies: [
    {
      id: "floor-1-enemy-1",
      position: {
        x: 7,
        y: 1,
      },
      species: "ogre",
      stats: {
        damage: 20,
        defence: 10,
        hp: 100,
      },
      drops: {
        currency: 100,
      },
    },
    {
      id: "floor-1-enemy-2",
      position: {
        x: 5,
        y: 12,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 20,
      },
    },
    {
      id: "floor-1-enemy-3",
      position: {
        x: 9,
        y: 12,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 20,
      },
    },
    {
      id: "floor-1-enemy-4",
      position: {
        x: 5,
        y: 2,
      },
      species: "wizard",
      stats: {
        damage: 8,
        defence: 0,
        hp: 10,
      },
    },
    {
      id: "floor-1-enemy-5",
      position: {
        x: 9,
        y: 2,
      },
      species: "wizard",
      stats: {
        damage: 8,
        defence: 0,
        hp: 10,
      },
    },
    {
      id: "floor-1-enemy-6",
      position: {
        x: 2,
        y: 11,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-7",
      position: {
        x: 2,
        y: 12,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-8",
      position: {
        x: 2,
        y: 13,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-9",
      position: {
        x: 12,
        y: 11,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-10",
      position: {
        x: 12,
        y: 12,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-11",
      position: {
        x: 12,
        y: 13,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-12",
      position: {
        x: 4,
        y: 12,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-1-enemy-13",
      position: {
        x: 10,
        y: 12,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-1-enemy-14",
      position: {
        x: 4,
        y: 7,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-1-enemy-15",
      position: {
        x: 10,
        y: 7,
      },
      species: "ogre",
      stats: {
        damage: 6,
        defence: 4,
        hp: 30,
      },
    },
    {
      id: "floor-1-enemy-16",
      position: {
        x: 4,
        y: 2,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-17",
      position: {
        x: 3,
        y: 1,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-18",
      position: {
        x: 3,
        y: 3,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-19",
      position: {
        x: 3,
        y: 2,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-20",
      position: {
        x: 10,
        y: 2,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-21",
      position: {
        x: 11,
        y: 1,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-22",
      position: {
        x: 11,
        y: 2,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-23",
      position: {
        x: 11,
        y: 3,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-24",
      position: {
        x: 4,
        y: 8,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-25",
      position: {
        x: 4,
        y: 6,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-26",
      position: {
        x: 10,
        y: 6,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
    {
      id: "floor-1-enemy-27",
      position: {
        x: 10,
        y: 8,
      },
      species: "goblin",
      stats: {
        damage: 4,
        defence: 1,
        hp: 12,
      },
    },
  ],
  items: [
    {
      id: "floor-1-item-1",
      position: {
        x: 1,
        y: 11,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-2",
      position: {
        x: 1,
        y: 12,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-3",
      position: {
        x: 1,
        y: 13,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-4",
      position: {
        x: 13,
        y: 11,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-5",
      position: {
        x: 13,
        y: 13,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-6",
      position: {
        x: 13,
        y: 12,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-7",
      position: {
        x: 1,
        y: 1,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-8",
      position: {
        x: 1,
        y: 3,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-9",
      position: {
        x: 13,
        y: 1,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-10",
      position: {
        x: 13,
        y: 3,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-11",
      position: {
        x: 1,
        y: 2,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-12",
      position: {
        x: 13,
        y: 2,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-13",
      position: {
        x: 3,
        y: 12,
      },
      kind: "key",
      payload: {
        id: "key-bronze",
        keyType: "bronze",
      },
    },
    {
      id: "floor-1-item-14",
      position: {
        x: 11,
        y: 12,
      },
      kind: "key",
      payload: {
        id: "key-bronze",
        keyType: "bronze",
      },
    },
    {
      id: "floor-1-item-15",
      position: {
        x: 11,
        y: 11,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-16",
      position: {
        x: 11,
        y: 13,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-17",
      position: {
        x: 3,
        y: 11,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-18",
      position: {
        x: 3,
        y: 13,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-19",
      position: {
        x: 1,
        y: 5,
      },
      kind: "armor",
      payload: {
        material: "leather",
        slot: "helm",
      },
    },
    {
      id: "floor-1-item-20",
      position: {
        x: 13,
        y: 5,
      },
      kind: "weapon",
      payload: "sword",
    },
    {
      id: "floor-1-item-21",
      position: {
        x: 3,
        y: 5,
      },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor-1-item-22",
      position: {
        x: 11,
        y: 5,
      },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor-1-item-23",
      position: {
        x: 12,
        y: 5,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-24",
      position: {
        x: 2,
        y: 5,
      },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor-1-item-25",
      position: {
        x: 1,
        y: 9,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-26",
      position: {
        x: 1,
        y: 8,
      },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor-1-item-27",
      position: {
        x: 13,
        y: 9,
      },
      kind: "potionDefense",
      payload: undefined,
    },
    {
      id: "floor-1-item-28",
      position: {
        x: 13,
        y: 8,
      },
      kind: "potionAttack",
      payload: undefined,
    },
  ],
  keyedDoors: [
    {
      id: "floor-1-door-1",
      position: {
        x: 5,
        y: 7,
      },
      doorType: "bronze",
    },
    {
      id: "floor-1-door-2",
      position: {
        x: 9,
        y: 7,
      },
      doorType: "bronze",
    },
  ],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  zone: "stone",
  wallZoneOverrides: [],
};
