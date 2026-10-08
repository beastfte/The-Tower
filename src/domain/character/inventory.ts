import type { DropTable } from "./grades";
import type { PlayerCharacterState } from "./save";

/**
 * Applies a defeated enemy's rolled drop (034): gold adds to the running total and a gear item
 * goes into the bag, the same as collecting a floor item. The caller has already trimmed the
 * gear to what the bag can take (`fitDropsToBag`).
 */
export function applyDropTable(
  character: PlayerCharacterState,
  drops: DropTable | undefined,
): PlayerCharacterState {
  if (!drops) return character;
  let next = character;
  if (drops.currency) next = { ...next, currency: next.currency + drops.currency };
  if (drops.gear) next = { ...next, bagGear: [...(next.bagGear ?? []), drops.gear] };
  return next;
}
