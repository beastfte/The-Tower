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

export type ArmorTierId = "leather" | "mail" | "plate";

export interface ArmorTierDefinition {
  id: ArmorTierId;
  name: string;
  defenceBonus: number;
  order: number;
  textureKey: string;
}
