import type { ArmorPieceDefinition, ArmorMaterialId, ArmorSlotId } from "../domain/character/types";

/** Static reference data (018 FR-015a): cloth is gone; each surviving tier inherits the value the
 * tier below it used to carry (leather = old cloth, mail = old leather, plate = old mail). Each
 * subsequent tier's value for a given slot is still exactly double the previous tier's value for
 * that same slot. Keyed by `${material}:${slot}` (011 research.md #5). */
export const ARMOR_PIECES: Record<string, ArmorPieceDefinition> = {
  "leather:helm": { material: "leather", slot: "helm", name: "Leather Helm", defenceBonus: 3, textureKey: "leatherHelm" },
  "leather:chest": { material: "leather", slot: "chest", name: "Leather Chest", defenceBonus: 4, textureKey: "leatherChest" },
  "leather:legs": { material: "leather", slot: "legs", name: "Leather Legs", defenceBonus: 2, textureKey: "leatherLegs" },
  "leather:boots": { material: "leather", slot: "boots", name: "Leather Boots", defenceBonus: 1, textureKey: "leatherBoots" },

  "mail:helm": { material: "mail", slot: "helm", name: "Mail Helm", defenceBonus: 6, textureKey: "mailHelm" },
  "mail:chest": { material: "mail", slot: "chest", name: "Mail Chest", defenceBonus: 8, textureKey: "mailChest" },
  "mail:legs": { material: "mail", slot: "legs", name: "Mail Legs", defenceBonus: 4, textureKey: "mailLegs" },
  "mail:boots": { material: "mail", slot: "boots", name: "Mail Boots", defenceBonus: 2, textureKey: "mailBoots" },

  "plate:helm": { material: "plate", slot: "helm", name: "Plate Helm", defenceBonus: 12, textureKey: "plateHelm" },
  "plate:chest": { material: "plate", slot: "chest", name: "Plate Chest", defenceBonus: 16, textureKey: "plateChest" },
  "plate:legs": { material: "plate", slot: "legs", name: "Plate Legs", defenceBonus: 8, textureKey: "plateLegs" },
  "plate:boots": { material: "plate", slot: "boots", name: "Plate Boots", defenceBonus: 4, textureKey: "plateBoots" },
};

/** Composite-key helper so callers never hand-build the `${material}:${slot}` string themselves. */
export function armorPieceKey(material: ArmorMaterialId, slot: ArmorSlotId): string {
  return `${material}:${slot}`;
}
