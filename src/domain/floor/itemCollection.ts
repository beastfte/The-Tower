import { positionKey, type Position } from "../types";
import type { PlayerCharacterState } from "../character/save";
import { ARMOR_MATERIAL_ORDER, type KeyDefinition, type LootItem, type WeaponId } from "../character/types";
import { restoreToFullHp } from "../character/combatStats";
import type { ArmorPickupPayload, ChestReward, ItemDefinition, FloorDefinition } from "./types";

/** Returns the not-yet-collected item at a position, if any. */
export function findAvailableItemAt(
  floor: FloorDefinition,
  position: Position,
  collectedItemIds: ReadonlySet<string>,
): ItemDefinition | undefined {
  return floor.items.find(
    (i) => positionKey(i.position) === positionKey(position) && !collectedItemIds.has(i.id),
  );
}

/**
 * Applies a collected item to the player character, dispatching by kind:
 * - key (FR-013a): adds the key's type to `keyIds` so matching keyed doors open
 * - loot / currency (FR-006, FR-007): added directly to inventory / currency total (User Story 2)
 * - armor (011 FR-001/FR-004): equips the pickup's slot with its material only if strictly
 *   higher-tier than whatever's already equipped there — independent per slot, override not
 *   additive
 * - potion (005 FR-002): restores HP to full via restoreToFullHp
 * - potionAttack / potionDefense (011 FR-007/FR-008): permanently adds to bonusDamage /
 *   baseStats.defence — cumulative across repeated pickups, no cap
 * - chest (005 FR-005): applies the exact same effect as its revealed reward, by reusing
 *   the matching case's own logic rather than re-deriving it
 */
export function applyItemPickup(character: PlayerCharacterState, item: ItemDefinition): PlayerCharacterState {
  switch (item.kind) {
    case "key": {
      const key = item.payload as KeyDefinition;
      if (character.keyIds.includes(key.keyType)) return character;
      return { ...character, keyIds: [...character.keyIds, key.keyType] };
    }
    case "loot": {
      const loot = item.payload as LootItem;
      return { ...character, inventory: [...character.inventory, loot.id] };
    }
    case "currency": {
      const amount = item.payload as number;
      return { ...character, currency: character.currency + amount };
    }
    case "weapon": {
      const weaponId = item.payload as WeaponId;
      return { ...character, equippedWeaponId: weaponId };
    }
    case "armor": {
      const pickup = item.payload as ArmorPickupPayload;
      const current = character.equippedArmor[pickup.slot];
      if (current && ARMOR_MATERIAL_ORDER[current] >= ARMOR_MATERIAL_ORDER[pickup.material]) {
        return character;
      }
      return {
        ...character,
        equippedArmor: { ...character.equippedArmor, [pickup.slot]: pickup.material },
      };
    }
    case "potion": {
      return restoreToFullHp(character);
    }
    case "potionAttack": {
      return { ...character, bonusDamage: character.bonusDamage + 5 };
    }
    case "potionDefense": {
      return {
        ...character,
        baseStats: { ...character.baseStats, defence: character.baseStats.defence + 2 },
      };
    }
    case "chest": {
      const reward = item.payload as ChestReward;
      switch (reward.kind) {
        case "currency":
          return { ...character, currency: character.currency + reward.amount };
        case "potion":
          return restoreToFullHp(character);
      }
    }
  }
}
