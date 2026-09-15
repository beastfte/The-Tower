import { positionKey, type Position } from "../types";
import type { FloorDefinition, LeverDefinition } from "../floor/types";

/** Returns the lever at a position, if any (007 US3). */
export function findLeverAt(
  floor: FloorDefinition,
  position: Position,
): LeverDefinition | undefined {
  return floor.levers.find((l) => positionKey(l.position) === positionKey(position));
}

export interface ResolvedLeverEffects {
  unlockedDoorIds: Set<string>;
  revealedPathwayPositions: Position[];
  deactivatedTrapIds: Set<string>;
}

/** Derives the combined effect of every currently-toggled lever on a floor (data-model.md
 * "Derived State") — recomputed on demand, never persisted, since it's fully derivable from
 * `floor.levers` (fixed content) and `toggledLeverIds` (persisted per-attempt state). */
export function resolveLeverEffects(
  floor: FloorDefinition,
  toggledLeverIds: readonly string[],
): ResolvedLeverEffects {
  const toggled = new Set(toggledLeverIds);
  const unlockedDoorIds = new Set<string>();
  const revealedPathwayPositions: Position[] = [];
  const deactivatedTrapIds = new Set<string>();

  for (const lever of floor.levers) {
    if (!toggled.has(lever.id)) continue;
    switch (lever.effect.kind) {
      case "unlockDoor":
        unlockedDoorIds.add(lever.effect.doorId);
        break;
      case "revealPathway":
        revealedPathwayPositions.push(lever.effect.position);
        break;
      case "deactivateTraps":
        for (const id of lever.effect.targetIds) deactivatedTrapIds.add(id);
        break;
    }
  }

  return { unlockedDoorIds, revealedPathwayPositions, deactivatedTrapIds };
}
