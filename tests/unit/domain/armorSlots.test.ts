import { describe, expect, it } from "vitest";
import { applyItemPickup } from "../../../src/domain/floor/itemCollection";
import { equipFromBag } from "../../../src/domain/character/bag";
import type { PlayerCharacterState } from "../../../src/domain/character/save";
import { computeEffectiveStats } from "../../../src/domain/character/combatStats";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { ARMOR_PIECES } from "../../../src/data/armorPieces";
import { WEAPONS } from "../../../src/data/weapons";
import type { ItemDefinition, ArmorPickupPayload } from "../../../src/domain/floor/types";
import type { ArmorMaterialId, ArmorSlotId, WeaponId, ArmorPieceDefinition } from "../../../src/domain/character/types";

const position = { x: 0, y: 0 };
const armorCatalog: ReadonlyMap<string, ArmorPieceDefinition> = new Map(Object.entries(ARMOR_PIECES));
const weaponCatalog = new Map(Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][]);

function armorItem(material: ArmorMaterialId, slot: ArmorSlotId): ItemDefinition {
  const payload: ArmorPickupPayload = { material, slot };
  return { id: `test-armor-${material}-${slot}`, position, kind: "armor", payload };
}

/** 033 FR-015a: a pickup lands in the bag; wearing it is a separate, deliberate step. */
const g = (key: string) => ({ key, grade: "common" as const, extras: {} });
const wearNewest = (c: PlayerCharacterState): PlayerCharacterState => equipFromBag(c, (c.bagGear ?? []).length - 1);

describe("armor pickup goes to the bag, never worn automatically (033 FR-015a; supersedes 011 FR-004)", () => {
  it("adds the piece to the bag and leaves the slot empty", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const character = applyItemPickup(save.character, armorItem("leather", "helm"));
    expect(character.equippedArmor.helm).toBeUndefined();
    expect(character.bagGear).toEqual([g("leather:helm")]);
  });

  it("keeps every piece regardless of tier, even a lower or equal one", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = wearNewest(applyItemPickup(save.character, armorItem("mail", "legs")));
    character = applyItemPickup(character, armorItem("mail", "legs"));
    character = applyItemPickup(character, armorItem("leather", "legs"));
    expect(character.equippedArmor.legs).toBe("mail");
    expect(character.bagGear).toEqual([g("mail:legs"), g("leather:legs")]);
  });

  it("wearing a piece swaps it with what is worn in that slot", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = wearNewest(applyItemPickup(save.character, armorItem("leather", "chest")));
    character = wearNewest(applyItemPickup(character, armorItem("plate", "chest")));
    expect(character.equippedArmor.chest).toBe("plate");
    expect(character.bagGear).toEqual([g("leather:chest")]);
  });

  it("tracks each slot independently", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = wearNewest(applyItemPickup(save.character, armorItem("leather", "helm")));
    character = wearNewest(applyItemPickup(character, armorItem("plate", "boots")));
    expect(character.equippedArmor).toEqual({ helm: "leather", boots: "plate" });
  });
});

describe("computeEffectiveStats armor defence (011 FR-003)", () => {
  it("sums defence bonuses across every independently-equipped slot", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = wearNewest(applyItemPickup(save.character, armorItem("leather", "helm")));
    character = wearNewest(applyItemPickup(character, armorItem("mail", "chest")));
    character = wearNewest(applyItemPickup(character, armorItem("plate", "legs")));
    character = wearNewest(applyItemPickup(character, armorItem("leather", "boots")));

    const stats = computeEffectiveStats(character, weaponCatalog, armorCatalog);
    const expectedArmor =
      ARMOR_PIECES["leather:helm"]!.defenceBonus +
      ARMOR_PIECES["mail:chest"]!.defenceBonus +
      ARMOR_PIECES["plate:legs"]!.defenceBonus +
      ARMOR_PIECES["leather:boots"]!.defenceBonus;
    expect(stats.defence).toBe(character.baseStats.defence + expectedArmor);
  });

  it("contributes zero defence for unequipped slots", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const stats = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(stats.defence).toBe(save.character.baseStats.defence);
  });
});
