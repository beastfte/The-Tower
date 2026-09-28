import { describe, expect, it } from "vitest";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { createTower, validateTower } from "../../../src/domain/floor/tower";
import { WEAPONS } from "../../../src/data/weapons";
import { ARMOR_PIECES, armorPieceKey } from "../../../src/data/armorPieces";
import { ARMOR_MATERIAL_ORDER } from "../../../src/domain/character/types";
import type { ArmorMaterialId, ArmorSlotId, WeaponId } from "../../../src/domain/character/types";
import type { ArmorPickupPayload, ChestReward, FloorDefinition } from "../../../src/domain/floor/types";
import { rowFromPattern } from "../../../src/data/floors/gridHelpers";

/**
 * Tests must not depend on the live tower's authored content (src/data/floors) — it's
 * replaced wholesale whenever the tower is redesigned via the mapping tool's sync-tower
 * script. Every check here runs against a fixture tower instead, so redesigning the shipped
 * floors never touches this file. See src/data/README.md's "Testing against the tower" note.
 */
const FIXTURE_FLOOR_1: FloorDefinition = {
  id: "test-floor-1",
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
    { id: "f1-goblin", position: { x: 3, y: 7 }, species: "goblin", stats: { damage: 4, defence: 1, hp: 12 }, drops: { currency: 15 } },
  ],
  items: [
    { id: "f1-weapon", position: { x: 9, y: 2 }, kind: "weapon", payload: "sword" },
    { id: "f1-armor", position: { x: 11, y: 2 }, kind: "armor", payload: { material: "leather", slot: "chest" } },
    { id: "f1-potion", position: { x: 13, y: 4 }, kind: "potion", payload: undefined },
    { id: "f1-chest", position: { x: 7, y: 12 }, kind: "chest", payload: { kind: "currency", amount: 30 } },
    { id: "f1-key-bronze", position: { x: 5, y: 2 }, kind: "key", payload: { id: "key-bronze", keyType: "bronze" } },
  ],
  keyedDoors: [{ id: "f1-door-bronze", position: { x: 6, y: 7 }, doorType: "bronze" }],
  hazardTiles: [],
  spikePits: [{ id: "f1-spike", position: { x: 10, y: 10 }, damage: 5 }],
  lavaTiles: [{ id: "f1-lava", position: { x: 4, y: 7 }, damage: 8 }],
  levers: [{ id: "f1-lever", position: { x: 11, y: 10 }, effect: { kind: "deactivateTraps", targetIds: ["f1-spike"] } }],
  waterTiles: [{ id: "f1-water", position: { x: 2, y: 0 } }],
  crackedWalls: [{ id: "f1-cracked-wall", position: { x: 3, y: 10 } }],
  torches: [{ id: "f1-torch", position: { x: 3, y: 10 } }],
  wallZoneOverrides: [{ position: { x: 5, y: 0 }, zone: "frost" }],
};

const FIXTURE_FLOOR_FINAL: FloorDefinition = {
  id: "test-floor-final",
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
      id: "final-boss",
      position: { x: 7, y: 7 },
      species: "ogre",
      stats: { damage: 5, defence: 3, hp: 25 },
      isEndBoss: true,
      drops: { currency: 100 },
    },
  ],
  items: [
    { id: "final-armor", position: { x: 2, y: 3 }, kind: "armor", payload: { material: "mail", slot: "chest" } },
    { id: "final-weapon", position: { x: 3, y: 11 }, kind: "weapon", payload: "bow" },
    { id: "final-potion", position: { x: 11, y: 3 }, kind: "potion", payload: undefined },
    { id: "final-chest", position: { x: 11, y: 11 }, kind: "chest", payload: { kind: "currency", amount: 30 } },
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

const FIXTURE_TOWER = createTower([FIXTURE_FLOOR_1, FIXTURE_FLOOR_FINAL]);

describe("authored floor content", () => {
  it.each(FIXTURE_TOWER.floors)("floor $id satisfies the floor-data contract invariants", (floor) => {
    const result = validateFloorDefinition(floor);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("the tower satisfies the tower-level invariants (end boss, key reachability)", () => {
    const result = validateTower(FIXTURE_TOWER);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  // 004 contract (equipment-and-species-contract.md) invariant 10: every weapon/armor
  // item payload is a key in its respective static catalog.
  it.each(FIXTURE_TOWER.floors)("floor $id's weapon/armor items reference real catalog entries", (floor) => {
    for (const item of floor.items) {
      if (item.kind === "weapon") {
        expect(WEAPONS[item.payload as WeaponId]).toBeDefined();
      }
      if (item.kind === "armor") {
        const pickup = item.payload as ArmorPickupPayload;
        expect(ARMOR_PIECES[armorPieceKey(pickup.material, pickup.slot)]).toBeDefined();
      }
    }
  });

  // 011 FR-002: each slot's defence bonus strictly doubles from one tier to the next.
  it("armor pieces are strictly increasing in defence bonus with tier, per slot", () => {
    const slots: ArmorSlotId[] = ["helm", "chest", "legs", "boots"];
    const materials = (Object.keys(ARMOR_MATERIAL_ORDER) as ArmorMaterialId[]).sort(
      (a, b) => ARMOR_MATERIAL_ORDER[a] - ARMOR_MATERIAL_ORDER[b],
    );
    for (const slot of slots) {
      const bonuses = materials.map((material) => ARMOR_PIECES[armorPieceKey(material, slot)]!.defenceBonus);
      for (let i = 1; i < bonuses.length; i++) {
        expect(bonuses[i]).toBeGreaterThan(bonuses[i - 1]!);
      }
    }
  });

  // 004 contract invariant 12, revised by 014 research.md #7: the grid itself is capped at
  // 15x15 (invariant 8). A meaningfully large floor should still use most of that space
  // rather than being mostly walls.
  it.each(FIXTURE_TOWER.floors)("floor $id has a meaningfully large walkable area", (floor) => {
    const walkableCount = floor.grid.flat().filter((tile) => tile.walkable).length;
    expect(walkableCount).toBeGreaterThanOrEqual(150);
  });

  // 005 contract invariant 18: each floor places at least one potion and one chest (FR-009).
  it.each(FIXTURE_TOWER.floors)("floor $id places at least one potion and one chest", (floor) => {
    expect(floor.items.some((i) => i.kind === "potion")).toBe(true);
    expect(floor.items.some((i) => i.kind === "chest")).toBe(true);
  });

  // 005 contract invariant 15: every chest's ChestReward is well-formed.
  it.each(FIXTURE_TOWER.floors)("floor $id's chests carry a well-formed reward", (floor) => {
    for (const item of floor.items) {
      if (item.kind !== "chest") continue;
      const reward = item.payload as ChestReward;
      if (reward.kind === "currency") {
        expect(Number.isInteger(reward.amount)).toBe(true);
        expect(reward.amount).toBeGreaterThan(0);
      }
    }
  });
});
