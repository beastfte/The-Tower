import { describe, expect, it } from "vitest";
import { applyItemPickup } from "../../../src/domain/floor/itemCollection";
import { computeMaxHp } from "../../../src/domain/character/combatStats";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import type { ItemDefinition, ChestReward } from "../../../src/domain/floor/types";

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
