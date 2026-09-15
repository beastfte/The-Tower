import { describe, expect, it } from "vitest";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import type { FloorDefinition } from "../../../src/domain/floor/types";

/** A minimal 20x20 fully-walkable floor, extended per test with this feature's content. */
function baseFloor(overrides: Partial<FloorDefinition> = {}): FloorDefinition {
  const size = 20;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walkable: true })));
  return {
    id: "f1",
    grid,
    entrance: { x: 0, y: 0 },
    exit: { x: size - 1, y: size - 1 },
    enemies: [],
    items: [],
    keyedDoors: [],
    hazardTiles: [],
    spikePits: [],
    lavaTiles: [],
    levers: [],
    waterTiles: [],
    ...overrides,
  };
}

describe("validateFloorDefinition — water tiles (007 US4, invariant 10)", () => {
  it("rejects a water tile authored on a walkable grid cell", () => {
    const floor = baseFloor({ waterTiles: [{ id: "w1", position: { x: 5, y: 5 } }] });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 10"))).toBe(true);
  });

  it("accepts a water tile authored on a non-walkable grid cell", () => {
    const floor = baseFloor({ waterTiles: [{ id: "w1", position: { x: 5, y: 5 } }] });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.errors.some((e) => e.includes("invariant 10"))).toBe(false);
  });
});
