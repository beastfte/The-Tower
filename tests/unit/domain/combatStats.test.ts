import { describe, expect, it } from "vitest";
import { computeEffectiveStats } from "../../../src/domain/character/combatStats";
import type { PlayerCharacterState } from "../../../src/domain/character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../../src/domain/character/types";

const character = (overrides: Partial<PlayerCharacterState> = {}): PlayerCharacterState => ({
  baseStats: { damage: 10, defence: 2, hp: 30 },
  currentHp: 30,
  inventory: [],
  currency: 0,
  keyIds: [],
  equippedArmor: {},
  bonusDamage: 0,
  ...overrides,
});

const weapon = (extra: Partial<WeaponDefinition>): WeaponDefinition => ({
  id: "sword",
  name: "Test Sword",
  attackValue: 0,
  textureKey: "sword",
  ...extra,
});

/** 027 FR-033 / contract C7. Fixtures only — no shipped item carries these bonuses yet. */
describe("computeEffectiveStats live-battle stats (027)", () => {
  it("defaults to a 1s interval, 5% crit and 0 crit bonus with nothing equipped", () => {
    const stats = computeEffectiveStats(character(), new Map(), new Map());
    expect(stats.attackIntervalSec).toBe(1);
    expect(stats.critChance).toBe(0.05);
    expect(stats.critDamageBonus).toBe(0);
  });

  it("turns a +25% attack speed bonus into a 0.8s interval (SC-011)", () => {
    const weapons = new Map<WeaponId, WeaponDefinition>([["sword", weapon({ attackSpeedBonus: 0.25 })]]);
    const stats = computeEffectiveStats(character({ equippedWeaponId: "sword" }), weapons, new Map());
    expect(stats.attackIntervalSec).toBeCloseTo(0.8, 10);
  });

  it("sums crit bonuses across the weapon and every armour piece", () => {
    const weapons = new Map<WeaponId, WeaponDefinition>([["sword", weapon({ critChanceBonus: 0.05 })]]);
    const helm: ArmorPieceDefinition = {
      material: "leather",
      slot: "helm",
      name: "Test Helm",
      defenceBonus: 1,
      textureKey: "helm",
      critChanceBonus: 0.1,
      critDamageBonus: 0.25,
    };
    const armor = new Map([["leather:helm", helm]]);
    const stats = computeEffectiveStats(
      character({ equippedWeaponId: "sword", equippedArmor: { helm: "leather" } }),
      weapons,
      armor,
    );
    expect(stats.critChance).toBeCloseTo(0.2, 10);
    expect(stats.critDamageBonus).toBe(0.25);
    expect(stats.defence).toBe(3); // FR-014: defence derivation unchanged
  });
});
