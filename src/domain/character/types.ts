import type { CombatStats } from "../types";

export interface PowerupDefinition {
  id: string;
  statBonus: Partial<CombatStats>;
  description: string;
}

export interface LootItem {
  id: string;
  name: string;
}

export interface KeyDefinition {
  id: string;
  keyType: string;
}
