import { positionKey, type Position } from "../types";
import type { PlayerCharacterState } from "../character/save";
import type { KeyDefinition, LootItem, WeaponId } from "../character/types";
import { armorPieceKey } from "../../data/armorPieces";
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
 * - weapon / armor (033 FR-015a): added to the bag (`bagGear`), never worn automatically —
 *   supersedes 011 FR-004's higher-tier auto-equip and the old "weapon pickup replaces the
 *   worn weapon"
 * - potion (027 FR-045): carried, not drunk — adds 1 to potionCount; HP is unchanged. Drinking
 *   happens only in battle (domain/combat/battle.ts drinkPotion). Superseded 019 FR-007's heal.
 * - potionAttack / potionDefense (019 FR-005/FR-006): permanently adds 2 / 1 to bonusDamage /
 *   baseStats.defence — cumulative across repeated pickups, no cap
 * - chest (005 FR-005): applies the exact same effect as its revealed reward, by reusing
 *   the matching case's own logic rather than re-deriving it
 */
export function applyItemPickup(character: PlayerCharacterState, item: ItemDefinition): PlayerCharacterState {
  switch (item.kind) {
    case "key": {
      // bug fix: duplicate-key-pickup-dropped — keyIds is a multiset (one entry per held
      // key, consumed one at a time by applyDoorOpen), not a deduplicated set. A previous
      // guard here silently dropped a second key of an already-held type, permanently
      // locking any second door of that type since it never actually held two keys to
      // begin with. Re-collecting the *same* item twice is already prevented upstream via
      // FloorProgress.collectedItemIds, so no dedup is needed here.
      const key = item.payload as KeyDefinition;
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
      // 033 FR-015a: gear goes to the bag; the player decides whether to wear it.
      return { ...character, bagGear: [...(character.bagGear ?? []), item.payload as WeaponId] };
    }
    case "armor": {
      const pickup = item.payload as ArmorPickupPayload;
      return {
        ...character,
        bagGear: [...(character.bagGear ?? []), armorPieceKey(pickup.material, pickup.slot)],
      };
    }
    case "potion": {
      return addPotion(character);
    }
    case "potionAttack": {
      return { ...character, bonusDamage: character.bonusDamage + 2 };
    }
    case "potionDefense": {
      return {
        ...character,
        baseStats: { ...character.baseStats, defence: character.baseStats.defence + 1 },
      };
    }
    case "chest": {
      const reward = item.payload as ChestReward;
      switch (reward.kind) {
        case "currency":
          return { ...character, currency: character.currency + reward.amount };
        case "potion":
          return addPotion(character);
      }
    }
  }
}

/** 027 FR-045: a health potion goes into the carried count (no cap, FR-046). */
function addPotion(character: PlayerCharacterState): PlayerCharacterState {
  return { ...character, potionCount: (character.potionCount ?? 0) + 1 };
}
