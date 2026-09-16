import type { ArmorPieceDefinition, ArmorMaterialId, ArmorSlotId } from "../domain/character/types";

/** Static reference data (011 FR-002): cloth is the baseline; each subsequent tier's value for a
 * given slot is exactly double the previous tier's value for that same slot. Keyed by
 * `${material}:${slot}` (011 research.md #5). */
export const ARMOR_PIECES: Record<string, ArmorPieceDefinition> = {
  "cloth:helm": { material: "cloth", slot: "helm", name: "Cloth Helm", defenceBonus: 3, textureKey: "armor-cloth-helm" },
  "cloth:chest": { material: "cloth", slot: "chest", name: "Cloth Chest", defenceBonus: 4, textureKey: "armor-cloth-chest" },
  "cloth:legs": { material: "cloth", slot: "legs", name: "Cloth Legs", defenceBonus: 2, textureKey: "armor-cloth-legs" },
  "cloth:boots": { material: "cloth", slot: "boots", name: "Cloth Boots", defenceBonus: 1, textureKey: "armor-cloth-boots" },

  "leather:helm": { material: "leather", slot: "helm", name: "Leather Helm", defenceBonus: 6, textureKey: "armor-leather-helm" },
  "leather:chest": { material: "leather", slot: "chest", name: "Leather Chest", defenceBonus: 8, textureKey: "armor-leather-chest" },
  "leather:legs": { material: "leather", slot: "legs", name: "Leather Legs", defenceBonus: 4, textureKey: "armor-leather-legs" },
  "leather:boots": { material: "leather", slot: "boots", name: "Leather Boots", defenceBonus: 2, textureKey: "armor-leather-boots" },

  "mail:helm": { material: "mail", slot: "helm", name: "Mail Helm", defenceBonus: 12, textureKey: "armor-mail-helm" },
  "mail:chest": { material: "mail", slot: "chest", name: "Mail Chest", defenceBonus: 16, textureKey: "armor-mail-chest" },
  "mail:legs": { material: "mail", slot: "legs", name: "Mail Legs", defenceBonus: 8, textureKey: "armor-mail-legs" },
  "mail:boots": { material: "mail", slot: "boots", name: "Mail Boots", defenceBonus: 4, textureKey: "armor-mail-boots" },

  "plate:helm": { material: "plate", slot: "helm", name: "Plate Helm", defenceBonus: 24, textureKey: "armor-plate-helm" },
  "plate:chest": { material: "plate", slot: "chest", name: "Plate Chest", defenceBonus: 32, textureKey: "armor-plate-chest" },
  "plate:legs": { material: "plate", slot: "legs", name: "Plate Legs", defenceBonus: 16, textureKey: "armor-plate-legs" },
  "plate:boots": { material: "plate", slot: "boots", name: "Plate Boots", defenceBonus: 8, textureKey: "armor-plate-boots" },
};

/** Composite-key helper so callers never hand-build the `${material}:${slot}` string themselves. */
export function armorPieceKey(material: ArmorMaterialId, slot: ArmorSlotId): string {
  return `${material}:${slot}`;
}
