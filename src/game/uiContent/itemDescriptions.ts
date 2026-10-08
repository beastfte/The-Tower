import type { ArmorSlotId, LootItem } from "../../domain/character/types";
import type { Tower } from "../../domain/floor/tower";

/**
 * Presentation-layer copy for the side panel, tooltips, and pickup modal (research.md #4).
 * `LootItem`/`KeyDefinition` (src/domain/character/types.ts) carry no description text of
 * their own, and adding one there would mean modifying 001-fantasy-tower-adventure's domain
 * model — outside this feature's UI-only scope.
 *
 * Authoring note: every new `LootItem` id and every new `KeyDefinition`/`KeyedDoorDefinition`
 * type added to `src/data/floors/*` MUST get a matching entry below — enforced by
 * `tests/unit/game/itemDescriptions.test.ts`.
 */
/** 013: "loot-torch" removed — torches are now a decorative floor fixture (floor.torches),
 * never a collectible loot item (FR-010). */
export const lootDescriptions: Record<string, string> = {};

export const keyTypeDescriptions: Record<string, string> = {
  bronze: "A tarnished bronze key. Opens bronze-marked doors.",
  silver: "A polished silver key. Opens silver-marked doors.",
  gold: "A gleaming gold key. Opens gold-marked doors.",
};

/** 005 FR-002/FR-007, 019 FR-007/FR-008: every potion is identical, so this is a single fixed
 * string rather than an id-keyed lookup table like `lootDescriptions`/`keyTypeDescriptions`. */
export const potionDescription = "A vial of red liquid. Restores 10 HP.";

/** 011 FR-007/FR-008, 019 FR-005/FR-006/FR-008: fixed strings, mirroring potionDescription —
 * each new potion type is identical to itself regardless of tier (there isn't one). */
export const attackPotionDescription =
  "A tall flask of arcane purple liquid. Permanently raises your attack by 2.";
export const defensePotionDescription =
  "A squat bottle of liquid steel. Permanently raises your defence by 1.";

/** 011 FR-005/FR-006: one generic tooltip per slot, reused across all 4 tiers — the piece's own
 * catalog `name` (e.g. "Mail Chest") already carries the material distinction. */
export const armorSlotDescriptions: Record<ArmorSlotId, string> = {
  helm: "Head armor. Higher tiers give more defence and change how your helm looks.",
  chest: "Chest armor. Higher tiers give more defence and change how your chest piece looks.",
  legs: "Leg armor. Higher tiers give more defence and change how your legs look.",
  boots: "Boot armor. Higher tiers give more defence and change how your boots look.",
};

/** Maps every LootItem id referenced anywhere in the tower to its display name, for the side panel. */
export function buildLootNameCatalog(tower: Tower): ReadonlyMap<string, string> {
  const catalog = new Map<string, string>();
  for (const floor of tower.floors) {
    for (const item of floor.items) {
      if (item.kind === "loot") {
        const loot = item.payload as LootItem;
        catalog.set(loot.id, loot.name);
      }
    }
  }
  return catalog;
}
