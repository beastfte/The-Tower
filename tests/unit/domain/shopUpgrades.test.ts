import { describe, expect, it } from "vitest";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { applyUpgradePurchase, priceFor, UPGRADE_IDS, UPGRADES } from "../../../src/domain/character/shopUpgrades";

function freshCharacter() {
  return createInitialPlayerSave("floor-01", { x: 0, y: 0 }).character;
}

describe("shopUpgrades (contracts C1-C5)", () => {
  it("prices the first purchase of any upgrade at 5 gold (C1)", () => {
    const character = freshCharacter();
    expect(priceFor(character, "vicious")).toBe(5);
    expect(priceFor(character, "calm")).toBe(5);
    expect(priceFor(character, "robust")).toBe(5);
  });

  it("raises an upgrade's own price by 5 with every purchase of that same upgrade (C1)", () => {
    let character = { ...freshCharacter(), currency: 100 };
    character = applyUpgradePurchase(character, "vicious");
    expect(priceFor(character, "vicious")).toBe(10);
    character = applyUpgradePurchase(character, "vicious");
    expect(priceFor(character, "vicious")).toBe(15);
    character = applyUpgradePurchase(character, "vicious");
    expect(priceFor(character, "vicious")).toBe(20);
  });

  it("never changes another upgrade's price or count (C2)", () => {
    let character = { ...freshCharacter(), currency: 100 };
    character = applyUpgradePurchase(character, "vicious");
    character = applyUpgradePurchase(character, "vicious");
    expect(priceFor(character, "calm")).toBe(5);
    expect(priceFor(character, "robust")).toBe(5);
    expect(character.purchaseCounts?.calm).toBeUndefined();
    expect(character.purchaseCounts?.robust).toBeUndefined();
  });

  it("vicious raises bonusDamage by 5 and nothing else stat-related (C3)", () => {
    const character = { ...freshCharacter(), currency: 100 };
    const next = applyUpgradePurchase(character, "vicious");
    expect(next.bonusDamage).toBe(character.bonusDamage + 5);
    expect(next.baseStats).toEqual(character.baseStats);
    expect(next.currentHp).toBe(character.currentHp);
  });

  it("calm raises baseStats.defence by 5 (C3)", () => {
    const character = { ...freshCharacter(), currency: 100 };
    const next = applyUpgradePurchase(character, "calm");
    expect(next.baseStats.defence).toBe(character.baseStats.defence + 5);
    expect(next.baseStats.hp).toBe(character.baseStats.hp);
    expect(next.bonusDamage).toBe(character.bonusDamage);
  });

  it("robust raises both max HP and current HP by exactly 5, per the spec's own example (C3)", () => {
    const character = {
      ...freshCharacter(),
      currency: 100,
      baseStats: { damage: 10, defence: 2, hp: 30 },
      currentHp: 10,
    };
    const next = applyUpgradePurchase(character, "robust");
    expect(next.baseStats.hp).toBe(35);
    expect(next.currentHp).toBe(15);
  });

  it("robust at full HP raises both max and current by 5, never refilling beyond that (C3)", () => {
    const character = {
      ...freshCharacter(),
      currency: 100,
      baseStats: { damage: 10, defence: 2, hp: 30 },
      currentHp: 30,
    };
    const next = applyUpgradePurchase(character, "robust");
    expect(next.baseStats.hp).toBe(35);
    expect(next.currentHp).toBe(35);
  });

  it("refuses a purchase the player cannot afford, changing nothing (C4)", () => {
    const character = { ...freshCharacter(), currency: 4 };
    const next = applyUpgradePurchase(character, "vicious");
    expect(next).toEqual(character);
    expect(next.currency).toBe(4);
    expect(next.bonusDamage).toBe(character.bonusDamage);
  });

  it("deducts exactly the price shown before the purchase (C5)", () => {
    const character = { ...freshCharacter(), currency: 12 };
    const next = applyUpgradePurchase(character, "vicious");
    expect(next.currency).toBe(7);
  });

  it("succeeds when currency exactly equals the price, landing on zero (C5)", () => {
    const character = { ...freshCharacter(), currency: 5 };
    const next = applyUpgradePurchase(character, "vicious");
    expect(next.currency).toBe(0);
    expect(next.bonusDamage).toBe(character.bonusDamage + 5);
  });

  it("never mutates the input character's purchaseCounts object (aliasing invariant)", () => {
    const character = { ...freshCharacter(), currency: 100, purchaseCounts: { vicious: 1 } };
    const originalCounts = character.purchaseCounts;
    applyUpgradePurchase(character, "vicious");
    expect(character.purchaseCounts).toBe(originalCounts);
    expect(originalCounts).toEqual({ vicious: 1 });
  });

  it("keeps the persisted UpgradeId keys unchanged despite the reworded display labels (research R17)", () => {
    expect(UPGRADE_IDS).toEqual(["vicious", "calm", "robust"]);
  });

  it("reworks display labels and adds a statHint for the dialogue box (2026-09-30 amendment)", () => {
    expect(UPGRADES.vicious.label).toBe("Become more vicious");
    expect(UPGRADES.vicious.statHint).toBe("+5 attack");
    expect(UPGRADES.calm.label).toBe("Become more sturdy");
    expect(UPGRADES.calm.statHint).toBe("+5 defence");
    expect(UPGRADES.robust.label).toBe("Become more versatile");
    expect(UPGRADES.robust.statHint).toBe("+5 max HP");
  });

  it("still prices an upgrade correctly on a save with existing purchaseCounts from before the label rework", () => {
    const character = { ...freshCharacter(), currency: 100, purchaseCounts: { calm: 2 } };
    expect(priceFor(character, "calm")).toBe(15);
  });
});
