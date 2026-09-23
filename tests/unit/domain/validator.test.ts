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
    crackedWalls: [],
    torches: [],
    wallZoneOverrides: [],
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

describe("validateFloorDefinition — cracked walls & torches (013, invariants 15-17)", () => {
  it("rejects a cracked wall authored on a walkable grid cell", () => {
    const floor = baseFloor({ crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }] });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 16"))).toBe(true);
  });

  it("rejects a torch authored on a walkable grid cell", () => {
    const floor = baseFloor({ torches: [{ id: "t1", position: { x: 5, y: 5 } }] });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 16"))).toBe(true);
  });

  it("accepts a cracked wall and a co-located torch on the same non-walkable cell", () => {
    const floor = baseFloor({
      crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }],
      torches: [{ id: "t1", position: { x: 5, y: 5 } }],
    });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.errors.some((e) => e.includes("invariant 15"))).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 16"))).toBe(false);
  });

  it("rejects duplicate cracked wall ids", () => {
    const floor = baseFloor({
      crackedWalls: [
        { id: "cw1", position: { x: 5, y: 5 } },
        { id: "cw1", position: { x: 6, y: 6 } },
      ],
    });
    floor.grid[5]![5] = { walkable: false };
    floor.grid[6]![6] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 4"))).toBe(true);
  });

  it("rejects a cracked wall's position colliding with another piece of placed content", () => {
    const floor = baseFloor({
      crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }],
      waterTiles: [{ id: "w1", position: { x: 5, y: 5 } }],
    });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 6"))).toBe(true);
  });

  it("fails invariant 2 when the only entrance-to-exit path requires a cracked wall to break", () => {
    const size = 20;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walkable: false })));
    // A single-cell-wide corridor along y=0, blocked at x=10 by the (only) cracked wall.
    for (let x = 0; x < size; x++) grid[0]![x] = { walkable: true };
    grid[0]![10] = { walkable: false };
    const floor = baseFloor({
      grid,
      entrance: { x: 0, y: 0 },
      exit: { x: size - 1, y: 0 },
      crackedWalls: [{ id: "cw1", position: { x: 10, y: 0 } }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 2"))).toBe(true);
  });
});

describe("validateFloorDefinition — wall zone overrides (013 session 3, invariant 18)", () => {
  it("rejects a wall zone override authored on a walkable grid cell", () => {
    const floor = baseFloor({ wallZoneOverrides: [{ position: { x: 5, y: 5 }, zone: "crypt" }] });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 18"))).toBe(true);
  });

  it("accepts a wall zone override on a non-walkable cell, including one shared with a cracked wall", () => {
    const floor = baseFloor({
      crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }],
      wallZoneOverrides: [{ position: { x: 5, y: 5 }, zone: "crypt" }],
    });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.errors.some((e) => e.includes("invariant 18"))).toBe(false);
  });

  it("rejects a duplicated wall zone override position", () => {
    const floor = baseFloor({
      wallZoneOverrides: [
        { position: { x: 5, y: 5 }, zone: "crypt" },
        { position: { x: 5, y: 5 }, zone: "ember" },
      ],
    });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 18") && e.includes("duplicated"))).toBe(true);
  });
});
