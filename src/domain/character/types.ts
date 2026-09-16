export interface LootItem {
  id: string;
  name: string;
}

export interface KeyDefinition {
  id: string;
  keyType: string;
}

export type WeaponId = "sword" | "axe" | "mace" | "bow" | "staff";

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  attackValue: number;
  textureKey: string;
}

export type ArmorSlotId = "helm" | "chest" | "legs" | "boots";
export type ArmorMaterialId = "cloth" | "leather" | "mail" | "plate";

/** Ordinal rank for the "strictly higher tier only" pickup rule (FR-004) — independent of slot. */
export const ARMOR_MATERIAL_ORDER: Record<ArmorMaterialId, number> = {
  cloth: 0,
  leather: 1,
  mail: 2,
  plate: 3,
};

export interface ArmorPieceDefinition {
  material: ArmorMaterialId;
  slot: ArmorSlotId;
  name: string;
  defenceBonus: number;
  textureKey: string;
}
