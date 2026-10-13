import { describe, expect, it } from "vitest";
import { floorExportToDefinition, wallsToPatternRows } from "../../../scripts/floorConversion";
import type { FloorExport } from "../../../scripts/floorConversion";

function sampleExport(): FloorExport {
  return {
    id: "floor-sample",
    order: 3,
    width: 3,
    height: 3,
    walls: [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ],
    entrance: { x: 1, y: 1 },
    exit: { x: 1, y: 1 },
    enemies: [{ id: "e1", position: { x: 1, y: 1 }, species: "goblin" }],
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

describe("floorExportToDefinition", () => {
  it("turns walls into a walkable grid (inverse booleans) and drops `order`", () => {
    const def = floorExportToDefinition(sampleExport());
    expect(def.grid.map((row) => row.map((t) => t.walkable))).toEqual([
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ]);
    expect(def).not.toHaveProperty("order");
  });

  it("carries every non-grid field across, including feature-013 fields", () => {
    const fe = sampleExport();
    const def = floorExportToDefinition(fe);
    for (const key of ["id", "entrance", "exit", "enemies", "items", "keyedDoors", "spikePits", "levers", "crackedWalls", "zone", "wallZoneOverrides"] as const) {
      expect(def[key], key).toEqual(fe[key]);
    }
  });

  it("leaves `zone` unset when the export has none", () => {
    const fe = sampleExport();
    delete fe.zone;
    expect(Object.hasOwn(floorExportToDefinition(fe), "zone")).toBe(false);
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

describe("monster stats are never imported", () => {
  it("drops a stale export's stats and dodgeChance, keeping species, elite and boss flags", () => {
    const fe = sampleExport();
    const stale = { id: "e2", position: { x: 1, y: 1 }, species: "bat", isElite: true, stats: { damage: 9, defence: 9, hp: 9 }, dodgeChance: 0.5 };
    fe.enemies.push(stale as unknown as (typeof fe.enemies)[number]);
    const back = floorExportToDefinition(fe).enemies.find((e) => e.id === "e2");
    expect(back).toEqual({ id: "e2", position: { x: 1, y: 1 }, species: "bat", isElite: true });
  });
});

describe("monster drops are not authored (034 FR-020, FR-021)", () => {
  it("strips a stale `drops` key and keeps `isElite` through conversion", () => {
    const fe = sampleExport();
    const stale = { ...fe.enemies[0]!, isElite: true, drops: { currency: 15 } } as unknown as FloorExport["enemies"][number];
    const def = floorExportToDefinition({ ...fe, enemies: [stale] });
    expect(def.enemies[0]).not.toHaveProperty("drops");
    expect(def.enemies[0]?.isElite).toBe(true);
  });
});
