import type { FloorDefinition } from "../../domain/floor/types";
import { rowFromPattern } from "./gridHelpers";

/**
 * Floor 1, resized to the 15x15 baseline (014 FR-001) from the previous 20x20 grid. The main
 * corridor (row 7) runs the full width, with two solid-walled columns (x=3, x=6) each open
 * only at row 7 — mirroring floor-final's single-opening-column technique so the compulsory
 * goblin (x=3) and the bronze door (x=6) each remain the sole way across their column, exactly
 * as invariant 3 requires, without needing a maze of dedicated alcove walls. Everything else
 * (the rat, the ogre + spike pit + lever, the wizard, the silver/gold key/door pairs, every
 * item, the water tile, the cracked wall + torch, and three wallZoneOverrides) sits in the
 * three resulting open pockets — before the goblin, between the two gates (the bronze key's
 * alcove), and after the bronze door — none of it gates anything beyond the goblin/bronze-door
 * pair, matching the original floor's own "optional rooms are fully open interior space"
 * design. Per 014 FR-002/FR-009, empty tiles were trimmed first and only as much content as
 * comfortably fits a 225-tile floor was kept (two of the original four cloth armor pieces, and
 * 3 of the original 10 wallZoneOverride demo tiles, were dropped as redundant repeats of a
 * mechanic already exercised elsewhere on this same floor) — every remaining mechanic (keys/
 * doors of all 3 tiers, all 4 potion/currency pickup kinds, a weapon and an armor pickup, a
 * spike pit + deactivating lever, a lava tile, a water tile, a cracked wall, a torch, and
 * non-default wall zones) is still represented at least once.
 */
export const FLOOR_01: FloorDefinition = {
  id: "floor-01",
  grid: [
    rowFromPattern("###############"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("..............."),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("...#..#........"),
    rowFromPattern("###############"),
  ],
  entrance: { x: 0, y: 7 },
  exit: { x: 14, y: 7 },
  enemies: [
    {
      id: "floor01-goblin",
      position: { x: 3, y: 7 },
      species: "goblin",
      stats: { damage: 4, defence: 1, hp: 12 },
      drops: { currency: 15 },
    },
    {
      id: "floor01-rat",
      position: { x: 1, y: 10 },
      species: "goblin",
      stats: { damage: 3, defence: 0, hp: 10 },
      drops: { currency: 20 },
    },
    {
      id: "floor01-ogre",
      position: { x: 9, y: 9 },
      species: "ogre",
      stats: { damage: 6, defence: 4, hp: 20 },
      drops: { currency: 20 },
    },
    {
      id: "floor01-wizard",
      position: { x: 13, y: 12 },
      species: "wizard",
      stats: { damage: 7, defence: 0, hp: 8 },
      drops: { currency: 20 },
    },
  ],
  items: [
    {
      id: "floor01-key-bronze",
      position: { x: 5, y: 6 },
      kind: "key",
      payload: { id: "key-bronze", keyType: "bronze" },
    },
    {
      id: "floor01-gold-pile",
      position: { x: 7, y: 7 },
      kind: "currency",
      payload: 10,
    },
    {
      id: "floor01-weapon-sword",
      position: { x: 9, y: 2 },
      kind: "weapon",
      payload: "sword",
    },
    {
      id: "floor01-armor-leather",
      position: { x: 11, y: 2 },
      kind: "armor",
      payload: { material: "leather", slot: "chest" },
    },
    {
      id: "floor01-potion",
      position: { x: 13, y: 4 },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor01-chest",
      position: { x: 7, y: 12 },
      kind: "chest",
      payload: { kind: "currency", amount: 30 },
    },
    {
      id: "floor01-key-silver",
      position: { x: 13, y: 9 },
      kind: "key",
      payload: { id: "key-silver", keyType: "silver" },
    },
    {
      id: "floor01-key-gold",
      position: { x: 9, y: 12 },
      kind: "key",
      payload: { id: "key-gold", keyType: "gold" },
    },
    {
      id: "floor01-armor-cloth-helm",
      position: { x: 9, y: 4 },
      kind: "armor",
      payload: { material: "cloth", slot: "helm" },
    },
    {
      id: "floor01-armor-cloth-chest",
      position: { x: 11, y: 4 },
      kind: "armor",
      payload: { material: "cloth", slot: "chest" },
    },
    {
      id: "floor01-potion-attack",
      position: { x: 8, y: 13 },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor01-potion-defense",
      position: { x: 10, y: 13 },
      kind: "potionDefense",
      payload: undefined,
    },
  ],
  keyedDoors: [
    { id: "floor01-door-bronze", position: { x: 6, y: 7 }, doorType: "bronze" },
    { id: "floor01-door-silver", position: { x: 12, y: 11 }, doorType: "silver" },
    { id: "floor01-door-gold", position: { x: 11, y: 12 }, doorType: "gold" },
  ],
  hazardTiles: [],
  spikePits: [{ id: "floor01-spike", position: { x: 10, y: 10 }, damage: 5 }],
  lavaTiles: [{ id: "floor01-lava", position: { x: 4, y: 7 }, damage: 8 }],
  levers: [
    {
      id: "floor01-lever",
      position: { x: 11, y: 10 },
      effect: { kind: "deactivateTraps", targetIds: ["floor01-spike"] },
    },
  ],
  waterTiles: [{ id: "floor01-water", position: { x: 2, y: 0 } }],
  crackedWalls: [{ id: "floor01-cracked-wall", position: { x: 3, y: 10 } }],
  torches: [{ id: "floor01-torch", position: { x: 3, y: 10 } }],
  wallZoneOverrides: [
    { position: { x: 5, y: 0 }, zone: "frost" },
    { position: { x: 9, y: 0 }, zone: "ember" },
    { position: { x: 13, y: 0 }, zone: "arcane" },
  ],
};
