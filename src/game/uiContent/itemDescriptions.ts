import type { LootItem } from "../../domain/character/types";
import type { Tower } from "../../domain/floor/tower";

/**
 * Presentation-layer copy for the side panel, tooltips, and pickup modal (research.md #4).
 * `LootItem`/`KeyDefinition` (src/domain/character/types.ts) carry no description text of
 * their own, and adding one there would mean modifying 001-fantasy-tower-adventure's domain
 * model — outside this feature's UI-only scope. Powerup tooltips/modal text instead reuse
 * the existing `PowerupDefinition.description` field directly; no lookup entry is needed
 * for powerups here.
 *
 * Authoring note: every new `LootItem` id and every new `KeyDefinition`/`KeyedDoorDefinition`
 * type added to `src/data/floors/*` MUST get a matching entry below — enforced by
 * `tests/unit/game/itemDescriptions.test.ts`.
 */
export const lootDescriptions: Record<string, string> = {
  "loot-torch": "A rusty torch. Mostly useful for looking brave in the dark.",
};

export const keyTypeDescriptions: Record<string, string> = {
  bronze: "A tarnished bronze key. Opens bronze-marked doors.",
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
    for (const enemy of floor.enemies) {
      if (enemy.drops?.loot) {
        for (const loot of enemy.drops.loot) {
          catalog.set(loot.id, loot.name);
        }
      }
    }
  }
  return catalog;
}
