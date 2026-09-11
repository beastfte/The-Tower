import type { ArmorTierDefinition, ArmorTierId } from "../domain/character/types";

/** Static reference data (research.md #3): defenceBonus strictly increases with order
 * (FR-006). "none"/unarmoured is the implicit zero tier, not a catalog row. */
export const ARMOR_TIERS: Record<ArmorTierId, ArmorTierDefinition> = {
  leather: { id: "leather", name: "Leather Armor", defenceBonus: 2, order: 1, textureKey: "player-leather" },
  mail: { id: "mail", name: "Mail Armor", defenceBonus: 4, order: 2, textureKey: "player-mail" },
  plate: { id: "plate", name: "Plate Armor", defenceBonus: 7, order: 3, textureKey: "player-plate" },
};
