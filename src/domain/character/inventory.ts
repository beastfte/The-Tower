import type { DropTable } from "../floor/types";
import type { PlayerCharacterState } from "./save";

/**
 * Applies a defeated enemy's DropTable to the character (FR-005, FR-007): loot goes
 * into inventory, currency adds to the running total, and a key's type is added to
 * `keyIds` (FR-013a) — the same accumulation rules as collecting a fixed item, just
 * triggered by combat instead of walking onto a tile.
 */
export function applyDropTable(
  character: PlayerCharacterState,
  drops: DropTable | undefined,
): PlayerCharacterState {
  if (!drops) return character;

  let next = character;

  if (drops.loot && drops.loot.length > 0) {
    next = { ...next, inventory: [...next.inventory, ...drops.loot.map((l) => l.id)] };
  }
  if (drops.currency) {
    next = { ...next, currency: next.currency + drops.currency };
  }
  if (drops.key) {
    if (!next.keyIds.includes(drops.key.keyType)) {
      next = { ...next, keyIds: [...next.keyIds, drops.key.keyType] };
    }
  }

  return next;
}
