import { describe, expect, it } from "vitest";
import { createTower } from "../../../src/domain/floor/tower";
import { previousFloor, nextFloor } from "../../../src/domain/floor/tower";
import { completeCurrentFloor, returnToPreviousFloor } from "../../../src/domain/progress/towerProgress";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import type { FloorDefinition } from "../../../src/domain/floor/types";

/** A minimal fully-walkable floor, just enough shape for tower/progress logic (no content). */
function floor(id: string, overrides: Partial<FloorDefinition> = {}): FloorDefinition {
  const size = 15;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walkable: true })));
  return {
    id,
    grid,
    entrance: { x: 0, y: 7 },
    exit: { x: size - 1, y: 7 },
    enemies: [],
    items: [],
    keyedDoors: [],
    hazardTiles: [],
    spikePits: [],
    lavaTiles: [],
    levers: [],
    waterTiles: [],
    crackedWalls: [],
    wallZoneOverrides: [],
    ...overrides,
  };
}

describe("previousFloor (bug fix: backtrack-stairs-no-effect, FR-009a)", () => {
  const tower = createTower([floor("f1"), floor("f2"), floor("f3")]);

  it("returns null on the tower's first floor", () => {
    expect(previousFloor(tower, "f1")).toBeNull();
  });

  it("returns the floor immediately before the given one otherwise", () => {
    expect(previousFloor(tower, "f2")?.id).toBe("f1");
    expect(previousFloor(tower, "f3")?.id).toBe("f2");
  });

  it("mirrors nextFloor in the opposite direction (round-trips back to the start)", () => {
    const forward = nextFloor(tower, "f1");
    expect(forward?.id).toBe("f2");
    expect(previousFloor(tower, forward!.id)?.id).toBe("f1");
  });
});

describe("completeCurrentFloor (bug fix: checkpoint-restart-stat-exploit)", () => {
  const tower = createTower([floor("f1"), floor("f2")]);

  it("stamps checkpointCharacter to the character exactly as it stood entering the new floor", () => {
    let save = createInitialPlayerSave("f1", tower.floors[0]!.entrance);
    // Simulate having farmed some progress on f1 before reaching its exit.
    save.character = { ...save.character, currency: 40, bonusDamage: 5 };

    save = completeCurrentFloor(save, tower);

    expect(save.currentFloorId).toBe("f2");
    expect(save.checkpointCharacter).toEqual(save.character);
    expect(save.checkpointCharacter?.currency).toBe(40);
    expect(save.checkpointCharacter?.bonusDamage).toBe(5);
  });

  it("leaves checkpointCharacter untouched on the tower's last floor (no next floor to check into)", () => {
    let save = createInitialPlayerSave("f2", tower.floors[1]!.entrance);
    const before = save.checkpointCharacter;
    save = completeCurrentFloor(save, tower);
    expect(save.checkpointCharacter).toBe(before);
  });
});

describe("returnToPreviousFloor (bug fix: backtrack-stairs-no-effect, FR-009a/FR-010a)", () => {
  const tower = createTower([floor("f1"), floor("f2")]);

  it("is a no-op on the tower's first floor (nothing to step back to)", () => {
    const save = createInitialPlayerSave("f1", tower.floors[0]!.entrance);
    const result = returnToPreviousFloor(save, tower);
    expect(result).toBe(save);
  });

  it("restores the previous floor's frozen progress, not a fresh/empty one", () => {
    let save = createInitialPlayerSave("f1", tower.floors[0]!.entrance);
    // Simulate having defeated an enemy / collected an item on f1, then stepped onto its
    // exit tile (mirroring FloorScene.attemptMove: playerPosition is updated to the exit
    // *before* completeCurrentFloor freezes it).
    save.currentFloorState = {
      ...save.currentFloorState,
      defeatedEnemyIds: ["f1-goblin"],
      collectedItemIds: ["f1-sword"],
      playerPosition: tower.floors[0]!.exit,
    };
    save = completeCurrentFloor(save, tower);
    expect(save.currentFloorId).toBe("f2");

    const backtracked = returnToPreviousFloor(save, tower);
    expect(backtracked.currentFloorId).toBe("f1");
    // The permanence guarantee (FR-010a): defeated enemies / collected items must still be
    // gone, i.e. the restored state is the frozen one, not `emptyFloorProgress`.
    expect(backtracked.currentFloorState.defeatedEnemyIds).toEqual(["f1-goblin"]);
    expect(backtracked.currentFloorState.collectedItemIds).toEqual(["f1-sword"]);
    // Arrives at the previous floor's exit tile, mirroring where the player was standing
    // the moment they completed it.
    expect(backtracked.currentFloorState.playerPosition).toEqual(tower.floors[0]!.exit);
  });

  it("leaves completedFloorIds/completedFloorStates untouched", () => {
    let save = createInitialPlayerSave("f1", tower.floors[0]!.entrance);
    save = completeCurrentFloor(save, tower);
    const backtracked = returnToPreviousFloor(save, tower);
    expect(backtracked.completedFloorIds).toEqual(save.completedFloorIds);
    expect(backtracked.completedFloorStates).toEqual(save.completedFloorStates);
  });
});
