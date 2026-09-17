import type { FloorDefinition } from "./types";
import type { ValidationResult } from "./validator";

/** The ordered game world (FR-001). Assembled from authored floor content. */
export interface Tower {
  floors: FloorDefinition[];
  finalFloorIndex: number;
}

export function createTower(floors: FloorDefinition[]): Tower {
  return { floors, finalFloorIndex: floors.length - 1 };
}

function floorIndexById(tower: Tower, floorId: string): number {
  return tower.floors.findIndex((f) => f.id === floorId);
}

export function nextFloor(tower: Tower, currentFloorId: string): FloorDefinition | null {
  const index = floorIndexById(tower, currentFloorId);
  if (index === -1 || index >= tower.floors.length - 1) return null;
  return tower.floors[index + 1]!;
}

/** Mirrors `nextFloor`, one step the other direction (bug fix: backtrack-stairs-no-effect —
 * FR-009a). `null` on the tower's first floor, since there's nothing to step back to. */
export function previousFloor(tower: Tower, currentFloorId: string): FloorDefinition | null {
  const index = floorIndexById(tower, currentFloorId);
  if (index <= 0) return null;
  return tower.floors[index - 1]!;
}

/**
 * Validates tower-wide invariants from contracts/floor-data-contract.md:
 * floor-id uniqueness (invariant 4), exactly one compulsory end boss on the final floor
 * (invariant 5), and every keyed door having an obtainable matching key (invariant 7) unless
 * it's lever-unlocked instead (contracts/trap-mechanics-contract.md invariant 13).
 */
export function validateTower(tower: Tower): ValidationResult {
  const errors: string[] = [];

  const seenFloorIds = new Set<string>();
  for (const floor of tower.floors) {
    if (seenFloorIds.has(floor.id)) {
      errors.push(`Tower: duplicate floor id "${floor.id}" (invariant 4)`);
    }
    seenFloorIds.add(floor.id);
  }

  const endBosses = tower.floors.flatMap((floor, index) =>
    floor.enemies.filter((e) => e.isEndBoss).map((e) => ({ enemy: e, floor, index })),
  );
  if (endBosses.length !== 1) {
    errors.push(
      `Tower: expected exactly one end boss across the tower, found ${endBosses.length} (invariant 5)`,
    );
  } else {
    const { enemy, index } = endBosses[0]!;
    if (index !== tower.finalFloorIndex) {
      errors.push(`Tower: the end boss must be on the final floor (invariant 5)`);
    }
    if (enemy.placement !== "compulsory") {
      errors.push(`Tower: the end boss must be a compulsory enemy (invariant 5)`);
    }
  }

  const obtainableKeyTypes = new Set<string>();
  for (const floor of tower.floors) {
    for (const item of floor.items) {
      if (item.kind === "key") {
        obtainableKeyTypes.add((item.payload as { keyType: string }).keyType);
      }
    }
    for (const enemy of floor.enemies) {
      if (enemy.drops?.key) obtainableKeyTypes.add(enemy.drops.key.keyType);
    }
  }
  // 007 US3 (contract invariant 13): a door targeted by some lever's `unlockDoor` effect
  // legitimately needs no key at all — exempt it from the key-obtainability check below.
  const leverUnlockedDoorIds = new Set(
    tower.floors.flatMap((floor) =>
      floor.levers
        .filter((lever) => lever.effect.kind === "unlockDoor")
        .map((lever) => (lever.effect as { kind: "unlockDoor"; doorId: string }).doorId),
    ),
  );
  for (const floor of tower.floors) {
    for (const door of floor.keyedDoors) {
      if (leverUnlockedDoorIds.has(door.id)) continue;
      if (!obtainableKeyTypes.has(door.doorType)) {
        errors.push(
          `Tower: keyed door "${door.id}" on floor "${floor.id}" has no obtainable key of type "${door.doorType}" (invariant 7)`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
