import type { WeaponDefinition, WeaponId } from "../domain/character/types";

/** Static reference data (research.md #3): fixed game-balance constants, ascending
 * attack value so no two weapons tie (keeps SC-002 observable). */
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  sword: { id: "sword", name: "Sword", attackValue: 6, textureKey: "sword" },
  axe: { id: "axe", name: "Axe", attackValue: 8, textureKey: "axe" },
  mace: { id: "mace", name: "Mace", attackValue: 10, textureKey: "mace" },
  bow: { id: "bow", name: "Bow", attackValue: 12, textureKey: "bow" },
  staff: { id: "staff", name: "Staff", attackValue: 14, textureKey: "staff" },
};
