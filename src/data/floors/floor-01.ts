import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

/**
 * Floor 1 — the original single main corridor (y=10) is preserved exactly, including
 * every existing enemy/item/door/hazard position, so it remains the sole route from
 * entrance to exit (floor-data-contract invariant 3 — the goblin at (3,10) and the
 * bronze door at (6,10) are still the only way across). The three original 1-tile
 * alcoves (rat at (1,11), key at (5,9), torch at (8,9)) are widened into proper rooms
 * behind their same single-tile doorway, and two new dead-end rooms (ogre, wizard) are
 * added off previously-unused stretches of the corridor — scaling up the existing
 * "main corridor + alcoves" pattern (research.md #6) rather than replacing it. Walkable
 * area is 230 tiles across a 20x20 grid (FR-014, ≥15x15; FR-016's modest extra content:
 * one more monster species pairing plus a weapon and an armor pickup).
 */
export const FLOOR_01: FloorDefinition = {
  id: "floor-01",
  grid: [
    rowFromPattern("####################"),
    rowFromPattern("##.....#############"),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("##.....#......#....."),
    rowFromPattern("#####.##.#######.###"),
    rowFromPattern("...................."),
    rowFromPattern("#.#########.########"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
    rowFromPattern(".....####......#####"),
  ],
  entrance: { x: 0, y: 10 },
  exit: { x: 19, y: 10 },
  enemies: [
    {
      id: "floor01-goblin",
      position: { x: 3, y: 10 },
      species: "goblin",
      stats: { damage: 4, defence: 1, hp: 12 },
      placement: "compulsory",
      drops: { currency: 15 },
    },
    {
      id: "floor01-rat",
      position: { x: 1, y: 11 },
      species: "goblin",
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
    {
      id: "floor01-ogre",
      position: { x: 12, y: 15 },
      species: "ogre",
      stats: { damage: 6, defence: 4, hp: 20 },
      placement: "optional",
      drops: { currency: 20 },
    },
    {
      id: "floor01-wizard",
      position: { x: 17, y: 5 },
      species: "wizard",
      stats: { damage: 7, defence: 0, hp: 8 },
      placement: "optional",
      drops: { currency: 20 },
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
    {
      id: "floor01-weapon-sword",
      position: { x: 3, y: 3 },
      kind: "weapon",
      payload: "sword",
    },
    {
      id: "floor01-armor-leather",
      position: { x: 10, y: 4 },
      kind: "armor",
      payload: "leather",
    },
  ],
  keyedDoors: [{ id: "floor01-door-bronze", position: { x: 6, y: 10 }, doorType: "bronze" }],
  hazardTiles: [{ id: "floor01-lava", position: { x: 4, y: 10 }, damage: 8 }],
};
