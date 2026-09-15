import { positionKey, type Position } from "../types";
import type { PlayerCharacterState } from "../character/save";
import type { ArmorTierId, KeyDefinition, LootItem, WeaponId } from "../character/types";
import { restoreToFullHp } from "../character/combatStats";
import type { ChestReward, ItemDefinition, FloorDefinition } from "./types";

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
 * - potion (005 FR-002): restores HP to full via restoreToFullHp
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
      const armorTierId = item.payload as ArmorTierId;
      return { ...character, equippedArmorTier: armorTierId };
    }
    case "potion": {
      return restoreToFullHp(character);
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
