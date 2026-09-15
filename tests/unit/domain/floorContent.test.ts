import { describe, expect, it } from "vitest";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { validateTower } from "../../../src/domain/floor/tower";
import { TOWER } from "../../../src/data/floors";
import { WEAPONS } from "../../../src/data/weapons";
import { ARMOR_TIERS } from "../../../src/data/armorTiers";
import type { ArmorTierId, WeaponId } from "../../../src/domain/character/types";
import type { ChestReward } from "../../../src/domain/floor/types";

describe("authored floor content", () => {
  it.each(TOWER.floors)("floor $id satisfies the floor-data contract invariants", (floor) => {
    const result = validateFloorDefinition(floor);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("the tower satisfies the tower-level invariants (end boss, key reachability)", () => {
    const result = validateTower(TOWER);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  // 004 contract (equipment-and-species-contract.md) invariant 10: every weapon/armor
  // item payload is a key in its respective static catalog.
  it.each(TOWER.floors)("floor $id's weapon/armor items reference real catalog entries", (floor) => {
    for (const item of floor.items) {
      if (item.kind === "weapon") {
        expect(WEAPONS[item.payload as WeaponId]).toBeDefined();
      }
      if (item.kind === "armor") {
        expect(ARMOR_TIERS[item.payload as ArmorTierId]).toBeDefined();
      }
    }
  });

  // 004 contract invariant 11: armor tiers strictly increase in defence with order.
  it("armor tiers are strictly increasing in defence bonus with order", () => {
    const tiers = Object.values(ARMOR_TIERS).sort((a, b) => a.order - b.order);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.defenceBonus).toBeGreaterThan(tiers[i - 1]!.defenceBonus);
    }
  });

  // 004 contract invariant 12: both floors have a walkable area of at least 15x15 (225 tiles).
  it.each(TOWER.floors)("floor $id has a walkable area of at least 225 tiles", (floor) => {
    const walkableCount = floor.grid.flat().filter((tile) => tile.walkable).length;
    expect(walkableCount).toBeGreaterThanOrEqual(225);
  });

  // 005 contract invariant 18: each floor places at least one potion and one chest (FR-009).
  it.each(TOWER.floors)("floor $id places at least one potion and one chest", (floor) => {
    expect(floor.items.some((i) => i.kind === "potion")).toBe(true);
    expect(floor.items.some((i) => i.kind === "chest")).toBe(true);
  });

  // 005 contract invariant 15: every chest's ChestReward is well-formed.
  it.each(TOWER.floors)("floor $id's chests carry a well-formed reward", (floor) => {
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
