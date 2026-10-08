import type { WeaponDefinition, WeaponId } from "../domain/character/types";

/** Static reference data (018 FR-016/FR-017/FR-018): swords only, three tiers, ascending
 * attack value so no two weapons tie (keeps SC-002 observable). `sword` keeps its id for the
 * metal tier so a saved `equippedWeaponId: "sword"` stays valid. */
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  woodSword: { id: "woodSword", name: "Wooden Sword", attackValue: 3, textureKey: "woodSword" },
  sword: { id: "sword", name: "Sword", attackValue: 6, textureKey: "sword" },
  diamondSword: { id: "diamondSword", name: "Diamond Sword", attackValue: 14, textureKey: "diamondSword" },
};
