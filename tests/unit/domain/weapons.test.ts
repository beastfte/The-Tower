import { describe, expect, it } from "vitest";
import { WEAPONS } from "../../../src/data/weapons";
import { computeEffectiveStats } from "../../../src/domain/character/combatStats";
import type { PlayerCharacterState } from "../../../src/domain/character/save";
import type { WeaponId } from "../../../src/domain/character/types";

/** 018 FR-016/FR-017/FR-018: swords only, four tiers, ascending attack value. */
describe("WEAPONS (018 FR-016/FR-017/FR-018)", () => {
  it("has exactly 4 entries", () => {
    expect(Object.keys(WEAPONS)).toHaveLength(4);
  });

  it("has no axe/mace/bow/staff key", () => {
    for (const removed of ["axe", "mace", "bow", "staff"]) {
      expect(WEAPONS[removed as keyof typeof WEAPONS]).toBeUndefined();
    }
  });

  it("keeps 'sword' as the metal tier's id, so a saved equippedWeaponId stays valid (FR-018)", () => {
    expect(WEAPONS.sword).toBeDefined();
    expect(WEAPONS.sword.id).toBe("sword");
  });

  it("has strictly ascending attackValue: wooden 3, metal 6, gold 10, diamond 14", () => {
    expect(WEAPONS.woodSword.attackValue).toBe(3);
    expect(WEAPONS.sword.attackValue).toBe(6);
    expect(WEAPONS.goldSword.attackValue).toBe(10);
    expect(WEAPONS.diamondSword.attackValue).toBe(14);

    const order = [WEAPONS.woodSword, WEAPONS.sword, WEAPONS.goldSword, WEAPONS.diamondSword];
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.attackValue).toBeGreaterThan(order[i - 1]!.attackValue);
    }
  });
});

/** 018 FR-022 / research R6: a save holding a removed weapon id degrades to unarmed rather
 * than crashing — computeEffectiveStats's catalog lookup already returns undefined for a
 * miss, and `weapon?.attackValue ?? 0` already treats that as no bonus. */
describe("save compatibility for a removed weapon id (018 FR-022)", () => {
  it("treats a removed weapon id as unarmed instead of throwing", () => {
    const weaponCatalog = new Map(Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][]);
    const character: PlayerCharacterState = {
      baseStats: { damage: 5, defence: 2, hp: 30 },
      currentHp: 30,
      inventory: [],
      keyIds: [],
      currency: 0,
      equippedWeaponId: "axe" as unknown as WeaponId,
      equippedArmor: {},
      bonusDamage: 0,
    };
    const stats = computeEffectiveStats(character, weaponCatalog, new Map());
    expect(stats.damage).toBe(character.baseStats.damage);
  });
});
