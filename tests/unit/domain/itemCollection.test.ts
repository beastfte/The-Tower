import { describe, expect, it } from "vitest";
import { applyItemPickup } from "../../../src/domain/floor/itemCollection";
import { computeMaxHp, computeEffectiveStats } from "../../../src/domain/character/combatStats";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { ARMOR_PIECES } from "../../../src/data/armorPieces";
import { WEAPONS } from "../../../src/data/weapons";
import type { ItemDefinition, ChestReward } from "../../../src/domain/floor/types";
import type { ArmorPieceDefinition, WeaponId } from "../../../src/domain/character/types";

const position = { x: 0, y: 0 };

function damagedCharacter() {
  const save = createInitialPlayerSave("floor-01", position);
  return { ...save.character, currentHp: save.character.currentHp - 12 };
}

describe("potion pickup (005 FR-001/FR-002, contract invariant 17)", () => {
  it("restores a damaged character to full HP", () => {
    const character = damagedCharacter();
    const potion: ItemDefinition = { id: "test-potion", position, kind: "potion", payload: undefined };

    const healed = applyItemPickup(character, potion);

    expect(healed.currentHp).toBe(computeMaxHp(character));
    expect(healed.currentHp).toBeGreaterThan(character.currentHp);
  });

  it("is harmless (still consumed, HP unchanged) when already at full HP", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const potion: ItemDefinition = { id: "test-potion", position, kind: "potion", payload: undefined };

    const result = applyItemPickup(save.character, potion);

    expect(result.currentHp).toBe(computeMaxHp(save.character));
    expect(result.currentHp).toBe(save.character.currentHp);
  });
});

describe("attack/defense potion pickups (011 FR-007/FR-008)", () => {
  const armorCatalog: ReadonlyMap<string, ArmorPieceDefinition> = new Map(Object.entries(ARMOR_PIECES));
  const weaponCatalog = new Map(Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][]);

  it("attack potion permanently adds 5 to bonusDamage, cumulative across repeated pickups", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const potion: ItemDefinition = { id: "test-atk-potion", position, kind: "potionAttack", payload: undefined };

    let character = applyItemPickup(save.character, potion);
    expect(character.bonusDamage).toBe(5);
    character = applyItemPickup(character, potion);
    expect(character.bonusDamage).toBe(10);
  });

  it("defense potion permanently adds 2 to baseStats.defence, cumulative across repeated pickups", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const potion: ItemDefinition = { id: "test-def-potion", position, kind: "potionDefense", payload: undefined };
    const startingDefence = save.character.baseStats.defence;

    let character = applyItemPickup(save.character, potion);
    expect(character.baseStats.defence).toBe(startingDefence + 2);
    character = applyItemPickup(character, potion);
    expect(character.baseStats.defence).toBe(startingDefence + 4);
  });

  it("attack potion bonus stays visible even while a weapon is equipped (weapon replaces base damage)", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const swordItem: ItemDefinition = { id: "test-sword", position, kind: "weapon", payload: "sword" };
    const potion: ItemDefinition = { id: "test-atk-potion", position, kind: "potionAttack", payload: undefined };

    let character = applyItemPickup(save.character, swordItem);
    const beforePotion = computeEffectiveStats(character, weaponCatalog, armorCatalog);

    character = applyItemPickup(character, potion);
    const afterPotion = computeEffectiveStats(character, weaponCatalog, armorCatalog);

    expect(afterPotion.damage).toBe(beforePotion.damage + 5);
  });
});

// bug fix: duplicate-key-pickup-dropped — keyIds is a multiset (010 spec Acceptance Scenario
// 4: two keys of the same type must open two doors of that type), not a deduplicated set.
describe("key pickup (010 FR-001, bug fix: duplicate-key-pickup-dropped)", () => {
  it("adds the key type to keyIds", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const key: ItemDefinition = { id: "test-key-1", position, kind: "key", payload: { id: "key-bronze-1", keyType: "bronze" } };

    const character = applyItemPickup(save.character, key);

    expect(character.keyIds).toEqual(["bronze"]);
  });

  it("a second key of the same type adds a second entry, not a no-op", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const key1: ItemDefinition = { id: "test-key-1", position, kind: "key", payload: { id: "key-bronze-1", keyType: "bronze" } };
    const key2: ItemDefinition = { id: "test-key-2", position, kind: "key", payload: { id: "key-bronze-2", keyType: "bronze" } };

    let character = applyItemPickup(save.character, key1);
    character = applyItemPickup(character, key2);

    expect(character.keyIds).toEqual(["bronze", "bronze"]);
  });

  it("a key of a different type is added independently", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const bronze: ItemDefinition = { id: "test-key-bronze", position, kind: "key", payload: { id: "key-bronze", keyType: "bronze" } };
    const silver: ItemDefinition = { id: "test-key-silver", position, kind: "key", payload: { id: "key-silver", keyType: "silver" } };

    let character = applyItemPickup(save.character, bronze);
    character = applyItemPickup(character, silver);

    expect(character.keyIds).toEqual(["bronze", "silver"]);
  });
});

describe("chest pickup applies the exact same effect as its revealed reward (005 FR-005, contract invariant 16)", () => {
  it("a currency-reward chest matches a plain currency pickup", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const reward: ChestReward = { kind: "currency", amount: 25 };
    const chest: ItemDefinition = { id: "test-chest", position, kind: "chest", payload: reward };
    const plainCurrency: ItemDefinition = { id: "test-gold", position, kind: "currency", payload: 25 };

    const fromChest = applyItemPickup(save.character, chest);
    const fromDirect = applyItemPickup(save.character, plainCurrency);

    expect(fromChest).toEqual(fromDirect);
  });

  it("a potion-reward chest matches a plain potion pickup", () => {
    const character = damagedCharacter();
    const reward: ChestReward = { kind: "potion" };
    const chest: ItemDefinition = { id: "test-chest", position, kind: "chest", payload: reward };
    const plainPotion: ItemDefinition = { id: "test-potion", position, kind: "potion", payload: undefined };

    const fromChest = applyItemPickup(character, chest);
    const fromDirect = applyItemPickup(character, plainPotion);

    expect(fromChest).toEqual(fromDirect);
  });
});
