import { describe, expect, it } from "vitest";
import { exportExistingFloors } from "../../../scripts/export-existing-floors";
import { floorExportToDefinition } from "../../../scripts/floorConversion";
import { TOWER } from "../../../src/data/floors";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { validateTower } from "../../../src/domain/floor/tower";

/** FR-016 / research.md #7 — the repo -> tool direction, run against the repo's real,
 * already-tested `floor-01`/`floor-final` fixtures rather than synthetic ones, so this test
 * fails immediately if the shared conversion module ever silently drops a field either of
 * those two real floors actually uses (torches, cracked walls, wall zone overrides, etc.). */
describe("exportExistingFloors — repo -> tool direction (FR-016)", () => {
  it("produces one FloorExport per floor in TOWER, order matching array position", () => {
    const result = exportExistingFloors(TOWER);
    expect(result.floors).toHaveLength(TOWER.floors.length);
    result.floors.forEach((fe, i) => {
      expect(fe.id).toBe(TOWER.floors[i]!.id);
      expect(fe.order).toBe(i);
    });
  });

  it("round-trips each real floor back into a FloorDefinition that still passes validateFloorDefinition", () => {
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

  it("preserves floor-01's torches, cracked walls, and wall zone overrides — fields the 012 contract doc's field list omits", () => {
    const result = exportExistingFloors(TOWER);
    const floor01 = TOWER.floors.find((f) => f.id === "floor-01")!;
    const floor01Export = result.floors.find((f) => f.id === "floor-01")!;

    expect(floor01.torches.length).toBeGreaterThan(0);
    expect(floor01.crackedWalls.length).toBeGreaterThan(0);
    expect(floor01.wallZoneOverrides.length).toBeGreaterThan(0);

    expect(floor01Export.torches).toEqual(floor01.torches);
    expect(floor01Export.crackedWalls).toEqual(floor01.crackedWalls);
    expect(floor01Export.wallZoneOverrides).toEqual(floor01.wallZoneOverrides);
  });

  it("reconstructs a 15x15 grid identical to the original for both real floors", () => {
    const result = exportExistingFloors(TOWER);
    for (const fe of result.floors) {
      expect(fe.width).toBe(15);
      expect(fe.height).toBe(15);
      const original = TOWER.floors.find((f) => f.id === fe.id)!;
      const roundTripped = floorExportToDefinition(fe);
      expect(roundTripped.grid).toEqual(original.grid);
    }
  });
});
