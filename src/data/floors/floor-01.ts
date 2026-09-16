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
 * one more monster species pairing plus a weapon and an armor pickup). 005 adds a health
 * potion in the wizard's dead-end room and a treasure chest (currency reward) in the
 * bottom-left room, both reachable without affecting the critical path (FR-009). 006
 * removed the powerup mechanic entirely (see spec.md) — the rat's drop and the chest's
 * reward, both formerly powerups, now grant currency instead. 007 retires the old
 * damage-once hazard tile at (4,10) in favor of a real lava tile at the same spot, and adds
 * one spike pit + a lever that deactivates it (both in the ogre's optional side room) plus
 * one water tile (a re-skinned wall cell in the top-left room) — none of this feature's new
 * content touches the critical path, so floor-01 remains completable exactly as before. 010
 * US1 adds a silver and a gold key/door pair for manual testing (FR-006), placed in the same
 * two optional side rooms: silver in the ogre's room (bottom, x9-15/y12-19), gold in the
 * wizard's room (top-right, x15-19/y2-8) — both rooms are fully open interior space, so
 * neither new door actually gates anything, they're only there to be walked onto and tested.
 * 011 adds one cloth-tier armor piece per slot (helm/chest/legs/boots) in the top-middle room
 * (x8-13/y2-8, alongside the existing migrated leather-chest piece) and one Attack Potion +
 * one Defense Potion in the bottom-left room (x0-4/y12-19, alongside the existing chest) — all
 * six for manual testing (FR-010), none on the critical path.
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
      drops: { currency: 20 },
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
      // 011: migrated from the old whole-character "leather" tier payload to a per-slot pickup
      // (research.md #7) — chest chosen as the closest analogue to a former whole-body piece.
      payload: { material: "leather", slot: "chest" },
    },
    {
      id: "floor01-potion",
      position: { x: 18, y: 3 },
      kind: "potion",
      payload: undefined,
    },
    {
      id: "floor01-chest",
      position: { x: 2, y: 15 },
      kind: "chest",
      payload: { kind: "currency", amount: 30 },
    },
    {
      id: "floor01-key-silver",
      position: { x: 9, y: 12 },
      kind: "key",
      payload: { id: "key-silver", keyType: "silver" },
    },
    {
      id: "floor01-key-gold",
      position: { x: 19, y: 2 },
      kind: "key",
      payload: { id: "key-gold", keyType: "gold" },
    },
    {
      id: "floor01-armor-cloth-helm",
      position: { x: 9, y: 3 },
      kind: "armor",
      payload: { material: "cloth", slot: "helm" },
    },
    {
      id: "floor01-armor-cloth-chest",
      position: { x: 12, y: 2 },
      kind: "armor",
      payload: { material: "cloth", slot: "chest" },
    },
    {
      id: "floor01-armor-cloth-legs",
      position: { x: 9, y: 6 },
      kind: "armor",
      payload: { material: "cloth", slot: "legs" },
    },
    {
      id: "floor01-armor-cloth-boots",
      position: { x: 12, y: 7 },
      kind: "armor",
      payload: { material: "cloth", slot: "boots" },
    },
    {
      id: "floor01-potion-attack",
      position: { x: 2, y: 13 },
      kind: "potionAttack",
      payload: undefined,
    },
    {
      id: "floor01-potion-defense",
      position: { x: 4, y: 17 },
      kind: "potionDefense",
      payload: undefined,
    },
  ],
  keyedDoors: [
    { id: "floor01-door-bronze", position: { x: 6, y: 10 }, doorType: "bronze" },
    { id: "floor01-door-silver", position: { x: 9, y: 13 }, doorType: "silver" },
    { id: "floor01-door-gold", position: { x: 19, y: 3 }, doorType: "gold" },
  ],
  // 007: the old instant, damage-once-on-entry hazard tile that used to sit here is retired —
  // this spot is now a real animated lava tile (entry damage + repeat damage while lingering,
  // same id/position/damage for continuity). The spike pit and its deactivating lever live in
  // the ogre's side room (optional, off the critical path); the water tile re-skins an
  // already-solid wall cell in the top-left room, so no grid/reachability changes are needed.
  hazardTiles: [],
  spikePits: [{ id: "floor01-spike", position: { x: 10, y: 15 }, damage: 5 }],
  lavaTiles: [{ id: "floor01-lava", position: { x: 4, y: 10 }, damage: 8 }],
  levers: [
    {
      id: "floor01-lever",
      position: { x: 13, y: 16 },
      effect: { kind: "deactivateTraps", targetIds: ["floor01-spike"] },
    },
  ],
  waterTiles: [{ id: "floor01-water", position: { x: 7, y: 1 } }],
};
