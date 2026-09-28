import { describe, expect, it } from "vitest";
import { applyItemPickup } from "../../../src/domain/floor/itemCollection";
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

describe("armor pickup (011 FR-001/FR-003/FR-004)", () => {
  it("equips an empty slot", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const character = applyItemPickup(save.character, armorItem("leather", "helm"));
    expect(character.equippedArmor.helm).toBe("leather");
  });

  it("overrides a slot when the new piece is strictly higher tier", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = applyItemPickup(save.character, armorItem("leather", "chest"));
    character = applyItemPickup(character, armorItem("plate", "chest"));
    expect(character.equippedArmor.chest).toBe("plate");
  });

  it("is a no-op when the new piece is an equal or lower tier", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = applyItemPickup(save.character, armorItem("mail", "legs"));
    character = applyItemPickup(character, armorItem("mail", "legs"));
    expect(character.equippedArmor.legs).toBe("mail");
    character = applyItemPickup(character, armorItem("leather", "legs"));
    expect(character.equippedArmor.legs).toBe("mail");
  });

  it("tracks each slot independently", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = applyItemPickup(save.character, armorItem("leather", "helm"));
    character = applyItemPickup(character, armorItem("plate", "boots"));
    expect(character.equippedArmor).toEqual({ helm: "leather", boots: "plate" });
  });
});

describe("computeEffectiveStats armor defence (011 FR-003)", () => {
  it("sums defence bonuses across every independently-equipped slot", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = applyItemPickup(save.character, armorItem("leather", "helm"));
    character = applyItemPickup(character, armorItem("mail", "chest"));
    character = applyItemPickup(character, armorItem("plate", "legs"));
    character = applyItemPickup(character, armorItem("leather", "boots"));

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
