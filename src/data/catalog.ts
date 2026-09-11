import type { Tower } from "../domain/floor/tower";
import type { PowerupDefinition } from "../domain/character/types";

/**
 * Indexes every PowerupDefinition referenced anywhere in the tower (fixed item
 * placements and enemy drops) by id, so effective-stat calculations (FR-008) can look
 * up a powerup's bonus from the id stored in `PlayerCharacterState.powerupIds`.
 */
export function buildPowerupCatalog(tower: Tower): Map<string, PowerupDefinition> {
  const catalog = new Map<string, PowerupDefinition>();
  for (const floor of tower.floors) {
    for (const item of floor.items) {
      if (item.kind === "powerup") {
        const powerup = item.payload as PowerupDefinition;
        catalog.set(powerup.id, powerup);
      }
    }
    for (const enemy of floor.enemies) {
      if (enemy.drops?.powerup) {
        catalog.set(enemy.drops.powerup.id, enemy.drops.powerup);
      }
    }
  }
  return catalog;
}
