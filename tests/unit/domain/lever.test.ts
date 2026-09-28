import { describe, expect, it } from "vitest";
import { resolveLeverEffects } from "../../../src/domain/hazard/lever";
import { applyLeverToggle } from "../../../src/domain/floor/floorState";
import { emptyFloorProgress } from "../../../src/domain/character/save";
import type { FloorDefinition, LeverDefinition } from "../../../src/domain/floor/types";

function makeFloor(levers: LeverDefinition[]): FloorDefinition {
  return {
    id: "f1",
    grid: [[{ walkable: true }, { walkable: true }]],
    entrance: { x: 0, y: 0 },
    exit: { x: 1, y: 0 },
    enemies: [],
    items: [],
    keyedDoors: [],
    hazardTiles: [],
    spikePits: [],
    lavaTiles: [],
    levers,
    waterTiles: [],
    crackedWalls: [],
    wallZoneOverrides: [],
  };
}

describe("resolveLeverEffects", () => {
  it("resolves an untoggled lever to no effect", () => {
    const floor = makeFloor([
      { id: "lever-door", position: { x: 0, y: 0 }, effect: { kind: "unlockDoor", doorId: "door-1" } },
    ]);
    const result = resolveLeverEffects(floor, []);
    expect(result.unlockedDoorIds.size).toBe(0);
    expect(result.revealedPathwayPositions).toHaveLength(0);
    expect(result.deactivatedTrapIds.size).toBe(0);
  });

  it("resolves unlockDoor", () => {
    const floor = makeFloor([
      { id: "lever-door", position: { x: 0, y: 0 }, effect: { kind: "unlockDoor", doorId: "door-1" } },
    ]);
    const result = resolveLeverEffects(floor, ["lever-door"]);
    expect(result.unlockedDoorIds.has("door-1")).toBe(true);
  });

  it("resolves revealPathway", () => {
    const floor = makeFloor([
      { id: "lever-path", position: { x: 0, y: 0 }, effect: { kind: "revealPathway", position: { x: 5, y: 5 } } },
    ]);
    const result = resolveLeverEffects(floor, ["lever-path"]);
    expect(result.revealedPathwayPositions).toEqual([{ x: 5, y: 5 }]);
  });

  it("resolves deactivateTraps", () => {
    const floor = makeFloor([
      {
        id: "lever-traps",
        position: { x: 0, y: 0 },
        effect: { kind: "deactivateTraps", targetIds: ["spike-1", "lava-1"] },
      },
    ]);
    const result = resolveLeverEffects(floor, ["lever-traps"]);
    expect(result.deactivatedTrapIds.has("spike-1")).toBe(true);
    expect(result.deactivatedTrapIds.has("lava-1")).toBe(true);
  });
});

describe("applyLeverToggle", () => {
  const lever: LeverDefinition = {
    id: "lever-1",
    position: { x: 0, y: 0 },
    effect: { kind: "unlockDoor", doorId: "door-1" },
  };

  it("toggles a fresh lever", () => {
    const progress = emptyFloorProgress("f1", { x: 0, y: 0 });
    const next = applyLeverToggle(progress, lever);
    expect(next.toggledLeverIds).toEqual(["lever-1"]);
  });

  it("is idempotent — toggling an already-toggled lever is a no-op", () => {
    const progress = { ...emptyFloorProgress("f1", { x: 0, y: 0 }), toggledLeverIds: ["lever-1"] };
    const next = applyLeverToggle(progress, lever);
    expect(next).toBe(progress);
  });
});
