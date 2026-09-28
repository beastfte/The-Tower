export interface LootItem {
  id: string;
  name: string;
}

/** 012 FR-018/FR-011 (research.md #11): a runtime-readable catalog of door/key tiers, so
 * tooling (e.g. scripts/sync-tool-palette.ts) can derive this set instead of hand-mirroring it.
 * Previously a bare `string` convention with no compiler-enforced or runtime-visible set. */
export const DOOR_KEY_TIERS = ["bronze", "silver", "gold"] as const;
export type DoorKeyTier = (typeof DOOR_KEY_TIERS)[number];

export interface KeyDefinition {
  id: string;
  keyType: string;
}

export type WeaponId = "woodSword" | "sword" | "goldSword" | "diamondSword";

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  attackValue: number;
  textureKey: string;
}

export type ArmorSlotId = "helm" | "chest" | "legs" | "boots";
export type ArmorMaterialId = "leather" | "mail" | "plate";

/** Ordinal rank for the "strictly higher tier only" pickup rule (FR-004) — independent of slot. */
export const ARMOR_MATERIAL_ORDER: Record<ArmorMaterialId, number> = {
  leather: 0,
  mail: 1,
  plate: 2,
};

export interface ArmorPieceDefinition {
  material: ArmorMaterialId;
  slot: ArmorSlotId;
  name: string;
  defenceBonus: number;
  textureKey: string;
}
