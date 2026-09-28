import { describe, expect, it } from "vitest";
import { floorDefinitionToExport, floorExportToDefinition, wallsToPatternRows } from "../../../scripts/floorConversion";
import type { FloorDefinition } from "../../../src/domain/floor/types";
import type { FloorExport } from "../../../scripts/floorConversion";

function sampleDefinition(): FloorDefinition {
  return {
    id: "floor-sample",
    grid: [
      [{ walkable: false }, { walkable: false }, { walkable: false }],
      [{ walkable: false }, { walkable: true }, { walkable: false }],
      [{ walkable: false }, { walkable: false }, { walkable: false }],
    ],
    entrance: { x: 1, y: 1 },
    exit: { x: 1, y: 1 },
    enemies: [
      {
        id: "e1",
        position: { x: 1, y: 1 },
        stats: { damage: 4, defence: 1, hp: 12 },
        species: "goblin",
        drops: { currency: 15 },
      },
    ],
    items: [{ id: "i1", position: { x: 1, y: 1 }, kind: "currency", payload: 10 }],
    keyedDoors: [{ id: "d1", position: { x: 1, y: 1 }, doorType: "bronze" }],
    hazardTiles: [],
    spikePits: [{ id: "s1", position: { x: 1, y: 1 }, damage: 5 }],
    lavaTiles: [],
    levers: [{ id: "l1", position: { x: 1, y: 1 }, effect: { kind: "unlockDoor", doorId: "d1" } }],
    waterTiles: [],
    crackedWalls: [{ id: "cw1", position: { x: 0, y: 0 } }],
    zone: "frost",
    wallZoneOverrides: [{ position: { x: 0, y: 0 }, zone: "ember" }],
  };
}

describe("wallsToPatternRows (research.md #4)", () => {
  it("renders a walls grid into rowFromPattern-style ASCII rows", () => {
    const walls = [
      [true, false, true],
      [false, false, false],
    ];
    expect(wallsToPatternRows(walls)).toEqual(["#.#", "..."]);
  });
});

describe("floorDefinitionToExport / floorExportToDefinition round-trip", () => {
  it("round-trips a grid (walkable <-> walls, inverse booleans) through both directions", () => {
    const def = sampleDefinition();
    const fe = floorDefinitionToExport(def, 3);
    expect(fe.width).toBe(3);
    expect(fe.height).toBe(3);
    expect(fe.walls).toEqual([
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ]);
    expect(fe.order).toBe(3);

    const roundTripped = floorExportToDefinition(fe);
    expect(roundTripped.grid).toEqual(def.grid);
  });

  it("round-trips every non-grid field byte-for-byte, including feature-013 fields not in the original schema doc", () => {
    const def = sampleDefinition();
    const fe = floorDefinitionToExport(def, 0);
    const roundTripped = floorExportToDefinition(fe);

    const { grid: _defGrid, ...defRest } = def;
    const { grid: _rtGrid, ...rtRest } = roundTripped;
    expect(rtRest).toEqual(defRest);

    // The specific fields the 012 contract doc's field list omits (documentation gap vs.
    // feature 013's later additions to FloorDefinition) must still survive the round-trip.
    expect(fe.crackedWalls).toEqual(def.crackedWalls);
    expect(fe.zone).toBe(def.zone);
    expect(fe.wallZoneOverrides).toEqual(def.wallZoneOverrides);
  });

  it("omits `zone` on the export when the definition has none, and leaves it unset on conversion back", () => {
    const def = sampleDefinition();
    delete def.zone;
    const fe = floorDefinitionToExport(def, 0);
    expect(fe.zone).toBeUndefined();
    expect(Object.hasOwn(fe, "zone")).toBe(false);

    const roundTripped = floorExportToDefinition(fe);
    expect(roundTripped.zone).toBeUndefined();
  });

  it("treats a missing walls row/cell as blocked (defensive default, matches a solid-rock assumption)", () => {
    const fe: FloorExport = {
      id: "floor-ragged",
      order: 0,
      width: 2,
      height: 2,
      walls: [[false]], // deliberately short — only row 0, only column 0
      entrance: { x: 0, y: 0 },
      exit: { x: 0, y: 0 },
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
    };
    const def = floorExportToDefinition(fe);
    expect(def.grid[0]![0]!.walkable).toBe(true); // explicitly false -> walkable
    expect(def.grid[0]![1]!.walkable).toBe(false); // missing cell -> defaults blocked
    expect(def.grid[1]![0]!.walkable).toBe(false); // missing row -> defaults blocked
  });
});
