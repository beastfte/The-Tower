import { describe, expect, it } from "vitest";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { validateTower } from "../../../src/domain/floor/tower";
import { TOWER } from "../../../src/data/floors";
import { WEAPONS } from "../../../src/data/weapons";
import { ARMOR_PIECES, armorPieceKey } from "../../../src/data/armorPieces";
import { ARMOR_MATERIAL_ORDER } from "../../../src/domain/character/types";
import type { ArmorMaterialId, ArmorSlotId, WeaponId } from "../../../src/domain/character/types";
import type { ArmorPickupPayload, ChestReward } from "../../../src/domain/floor/types";

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

  // 004 contract invariant 12, revised by 014 research.md #7: the grid itself is now capped at
  // exactly 225 tiles (15x15, invariant 8), so the old "≥225 walkable" bound is mathematically
  // unsatisfiable unless every tile were walkable (no walls at all). floor-01 has 171 walkable
  // tiles and floor-final has 183 — this threshold is set comfortably below both with margin,
  // rather than pinned to today's exact counts, so a small future content tweak to either floor
  // doesn't trip this check over a few tiles.
  it.each(TOWER.floors)("floor $id has a meaningfully large walkable area", (floor) => {
    const walkableCount = floor.grid.flat().filter((tile) => tile.walkable).length;
    expect(walkableCount).toBeGreaterThanOrEqual(150);
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
