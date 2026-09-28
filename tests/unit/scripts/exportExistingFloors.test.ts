import { describe, expect, it } from "vitest";
import { exportExistingFloors } from "../../../scripts/export-existing-floors";
import { floorExportToDefinition } from "../../../scripts/floorConversion";
import { createTower } from "../../../src/domain/floor/tower";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { validateTower } from "../../../src/domain/floor/tower";
import type { FloorDefinition } from "../../../src/domain/floor/types";

/** FR-016 / research.md #7 — the repo -> tool direction. Tests must not depend on the live
 * tower's authored content (src/data/floors) — it's replaced wholesale whenever the tower is
 * redesigned. This fixture floor exercises every field the 012 contract doc's field list
 * omits (cracked walls, wall zone overrides) plus a hazard/lever/keyed-door/item set,
 * on a single one-wide corridor so its lone enemy is automatically the compulsory end boss. */
function buildFixtureFloor(): FloorDefinition {
  const wallRow = () => Array.from({ length: 9 }, () => ({ walkable: false }));
  const corridorRow = () => Array.from({ length: 9 }, () => ({ walkable: true }));
  return {
    id: "test-floor",
    grid: [wallRow(), corridorRow(), wallRow()],
    entrance: { x: 0, y: 1 },
    exit: { x: 8, y: 1 },
    enemies: [
      {
        id: "test-boss",
        position: { x: 1, y: 1 },
        species: "ogre",
        stats: { damage: 5, defence: 3, hp: 25 },
        isEndBoss: true,
      },
    ],
    items: [
      { id: "test-sword", position: { x: 6, y: 1 }, kind: "weapon", payload: "sword" },
      { id: "test-armor", position: { x: 7, y: 1 }, kind: "armor", payload: { material: "leather", slot: "chest" } },
      { id: "test-key-bronze", position: { x: 8, y: 0 }, kind: "key", payload: { id: "key-bronze", keyType: "bronze" } },
    ],
    keyedDoors: [{ id: "test-door", position: { x: 2, y: 1 }, doorType: "bronze" }],
    hazardTiles: [],
    spikePits: [{ id: "test-spike", position: { x: 3, y: 1 }, damage: 5 }],
    lavaTiles: [{ id: "test-lava", position: { x: 4, y: 1 }, damage: 8 }],
    levers: [{ id: "test-lever", position: { x: 5, y: 1 }, effect: { kind: "deactivateTraps", targetIds: ["test-spike"] } }],
    waterTiles: [{ id: "test-water", position: { x: 1, y: 0 } }],
    crackedWalls: [{ id: "test-cracked-wall", position: { x: 0, y: 0 } }],
    wallZoneOverrides: [{ position: { x: 3, y: 0 }, zone: "frost" }],
    zone: "stone",
  };
}

describe("exportExistingFloors — repo -> tool direction (FR-016)", () => {
  const TOWER = createTower([buildFixtureFloor()]);

  it("produces one FloorExport per floor in the tower, order matching array position", () => {
    const result = exportExistingFloors(TOWER);
    expect(result.floors).toHaveLength(TOWER.floors.length);
    result.floors.forEach((fe, i) => {
      expect(fe.id).toBe(TOWER.floors[i]!.id);
      expect(fe.order).toBe(i);
    });
  });

  it("round-trips each floor back into a FloorDefinition that still passes validateFloorDefinition", () => {
    const result = exportExistingFloors(TOWER);
    for (const fe of result.floors) {
      const def = floorExportToDefinition(fe);
      const validation = validateFloorDefinition(def);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);
    }
  });

  it("round-trips the whole tower back into something that still passes validateTower", () => {
    const result = exportExistingFloors(TOWER);
    const defs = result.floors.map(floorExportToDefinition);
    const validation = validateTower({ floors: defs, finalFloorIndex: defs.length - 1 });
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("preserves cracked walls and wall zone overrides — fields the 012 contract doc's field list omits", () => {
    const result = exportExistingFloors(TOWER);
    const floor = TOWER.floors.find((f) => f.id === "test-floor")!;
    const floorExport = result.floors.find((f) => f.id === "test-floor")!;

    expect(floor.crackedWalls.length).toBeGreaterThan(0);
    expect(floor.wallZoneOverrides.length).toBeGreaterThan(0);

    expect(floorExport.crackedWalls).toEqual(floor.crackedWalls);
    expect(floorExport.wallZoneOverrides).toEqual(floor.wallZoneOverrides);
  });

  it("reconstructs a grid identical to the original", () => {
    const result = exportExistingFloors(TOWER);
    for (const fe of result.floors) {
      const original = TOWER.floors.find((f) => f.id === fe.id)!;
      expect(fe.width).toBe(original.grid[0]!.length);
      expect(fe.height).toBe(original.grid.length);
      const roundTripped = floorExportToDefinition(fe);
      expect(roundTripped.grid).toEqual(original.grid);
    }
  });
});
