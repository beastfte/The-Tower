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

  it("forces a water tile's own cell non-walkable, even when the author left `walls` open there", () => {
    const fe: FloorExport = {
      id: "floor-water",
      order: 0,
      width: 2,
      height: 1,
      walls: [[false, false]],
      entrance: { x: 0, y: 0 },
      exit: { x: 0, y: 0 },
      enemies: [],
      items: [],
      keyedDoors: [],
      hazardTiles: [],
      spikePits: [],
      lavaTiles: [],
      levers: [],
      waterTiles: [{ id: "w1", position: { x: 1, y: 0 } }],
      crackedWalls: [],
      wallZoneOverrides: [],
    };
    const def = floorExportToDefinition(fe);
    expect(def.grid[0]![0]!.walkable).toBe(true);
    expect(def.grid[0]![1]!.walkable).toBe(false);
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

describe("enemy dodgeChance override (032 C5)", () => {
  it("survives export and back, and an enemy without one gains none", () => {
    const def = sampleDefinition();
    def.enemies.push({ id: "e2", position: { x: 1, y: 1 }, stats: { damage: 1, defence: 0, hp: 1 }, species: "bat", dodgeChance: 0.5 });
    const back = floorExportToDefinition(floorDefinitionToExport(def, 0));
    expect(back.enemies.find((e) => e.id === "e2")?.dodgeChance).toBe(0.5);
    expect(back.enemies.find((e) => e.id === "e1")).not.toHaveProperty("dodgeChance");
  });
});

describe("monster drops are not authored (034 FR-020, FR-021)", () => {
  it("strips a stale `drops` key and keeps `isElite` through conversion", () => {
    const fe = floorDefinitionToExport(sampleDefinition(), 0);
    const stale = { ...fe.enemies[0]!, isElite: true, drops: { currency: 15 } } as unknown as FloorExport["enemies"][number];
    const def = floorExportToDefinition({ ...fe, enemies: [stale] });
    expect(def.enemies[0]).not.toHaveProperty("drops");
    expect(def.enemies[0]?.isElite).toBe(true);
  });
});
