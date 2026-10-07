import { describe, expect, it } from "vitest";
import { classifyEnemyPlacement, validateFloorDefinition } from "../../../src/domain/floor/validator";
import type { EnemyDefinition, FloorDefinition, ItemDefinition } from "../../../src/domain/floor/types";

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
    wallZoneOverrides: [],
    ...overrides,
  };
}

/** Builds a floor from a boolean walkability grid (`rows[y][x]`), for the classifier tests
 * below where a specific corridor shape matters more than the standard `baseFloor()` fixture. */
function floorFromGrid(rows: boolean[][], entrance: EnemyDefinition["position"], exit: EnemyDefinition["position"], enemies: EnemyDefinition[]): FloorDefinition {
  return {
    id: "f-classify",
    grid: rows.map((row) => row.map((walkable) => ({ walkable }))),
    entrance,
    exit,
    enemies,
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
}

function enemyAt(id: string, x: number, y: number): EnemyDefinition {
  return { id, position: { x, y }, species: "goblin", stats: { damage: 1, defence: 0, hp: 1 } };
}

describe("classifyEnemyPlacement (017) — computed from geometry, never authored", () => {
  it("classifies an enemy in a walls-sealed one-tile corridor as compulsory", () => {
    const enemy = enemyAt("e1", 2, 1);
    const floor = floorFromGrid(
      [
        [false, false, false, false, false],
        [true, true, true, true, true],
        [false, false, false, false, false],
      ],
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      [enemy],
    );
    expect(classifyEnemyPlacement(floor, enemy)).toBe("compulsory");
  });

  it("classifies an enemy beside a genuine alternate route as optional", () => {
    // A fully-open 3x3 room: the enemy sits dead center, but the border alone connects
    // entrance to exit without ever entering the center tile.
    const enemy = enemyAt("e1", 1, 1);
    const floor = floorFromGrid(
      [
        [true, true, true],
        [true, true, true],
        [true, true, true],
      ],
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      [enemy],
    );
    expect(classifyEnemyPlacement(floor, enemy)).toBe("optional");
  });

  it("classifies both enemies as optional when each guards one of two parallel routes (FR-008)", () => {
    // Top corridor (y=0) and bottom corridor (y=2), joined only at the x=0 and x=4 junction
    // columns; the middle row is walled off between them so the routes never merge.
    const enemyTop = enemyAt("top", 2, 0);
    const enemyBottom = enemyAt("bottom", 2, 2);
    const floor = floorFromGrid(
      [
        [true, true, true, true, true],
        [true, false, false, false, true],
        [true, true, true, true, true],
      ],
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      [enemyTop, enemyBottom],
    );
    expect(classifyEnemyPlacement(floor, enemyTop)).toBe("optional");
    expect(classifyEnemyPlacement(floor, enemyBottom)).toBe("optional");
  });

  it("classifies enemies in series on one corridor as each individually compulsory", () => {
    const enemyA = enemyAt("a", 2, 0);
    const enemyB = enemyAt("b", 3, 0);
    const floor = floorFromGrid([[true, true, true, true, true, true]], { x: 0, y: 0 }, { x: 5, y: 0 }, [
      enemyA,
      enemyB,
    ]);
    expect(classifyEnemyPlacement(floor, enemyA)).toBe("compulsory");
    expect(classifyEnemyPlacement(floor, enemyB)).toBe("compulsory");
  });
});

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

describe("validateFloorDefinition — cracked walls (013, invariant 16)", () => {
  it("rejects a cracked wall authored on a walkable grid cell", () => {
    const floor = baseFloor({ crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }] });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 16"))).toBe(true);
  });

  it("accepts a cracked wall on a non-walkable cell", () => {
    const floor = baseFloor({ crackedWalls: [{ id: "cw1", position: { x: 5, y: 5 } }] });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
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

describe("validateFloorDefinition — merchants (023, contract C12)", () => {
  it("accepts a merchant authored on a walkable grid cell", () => {
    const floor = baseFloor({ merchants: [{ id: "m1", position: { x: 5, y: 5 } }] });
    const result = validateFloorDefinition(floor);
    expect(result.errors.some((e) => e.includes("walkable grid cell"))).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 2"))).toBe(false);
  });

  it("rejects a merchant authored on a non-walkable grid cell — the inverse of water/cracked-wall", () => {
    const floor = baseFloor({ merchants: [{ id: "m1", position: { x: 5, y: 5 } }] });
    floor.grid[5]![5] = { walkable: false };
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must be on a walkable grid cell"))).toBe(true);
  });

  it("rejects duplicate merchant ids", () => {
    const floor = baseFloor({
      merchants: [
        { id: "m1", position: { x: 5, y: 5 } },
        { id: "m1", position: { x: 6, y: 6 } },
      ],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 4"))).toBe(true);
  });

  it("rejects a merchant's position colliding with another piece of placed content", () => {
    const floor = baseFloor({
      merchants: [{ id: "m1", position: { x: 5, y: 5 } }],
      waterTiles: [{ id: "w1", position: { x: 5, y: 5 } }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 6"))).toBe(true);
  });

  // 023 research R10: unlike an enemy (avoidable once defeated), a merchant can never be
  // cleared, so its tile must be treated as permanently impassable by the completability check
  // — the opposite of how enemy tiles are deliberately NOT blocked in this same BFS.
  it("fails invariant 2 when the only entrance-to-exit path requires passing through a merchant's tile", () => {
    const size = 20;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walkable: false })));
    // A single-cell-wide corridor along y=0, blocked at x=10 by the (only) merchant.
    for (let x = 0; x < size; x++) grid[0]![x] = { walkable: true };
    const floor = baseFloor({
      grid,
      entrance: { x: 0, y: 0 },
      exit: { x: size - 1, y: 0 },
      merchants: [{ id: "m1", position: { x: 10, y: 0 } }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 2"))).toBe(true);
  });

  it("does not block an enemy's own avoidability check merely by existing elsewhere on the floor", () => {
    // A merchant off to the side must not spuriously make an otherwise-optional enemy compulsory.
    const enemy = enemyAt("e1", 5, 5);
    const floor = baseFloor({ enemies: [enemy], merchants: [{ id: "m1", position: { x: 15, y: 15 } }] });
    expect(classifyEnemyPlacement(floor, enemy)).toBe("optional");
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

describe("validateFloorDefinition — removed-asset rejection (018 FR-024)", () => {
  // These payloads are deliberately outside the current type unions — they simulate a raw JSON
  // tower import naming a removed asset, which TypeScript can't catch but the validator must.
  it("rejects an item naming an unknown weapon id, by name", () => {
    const floor = baseFloor({
      items: [{ id: "i1", position: { x: 5, y: 5 }, kind: "weapon", payload: "axe" as unknown as ItemDefinition["payload"] }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("FR-024") && e.includes("axe"))).toBe(true);
  });

  it("rejects an item naming an unknown armour material, by name", () => {
    const floor = baseFloor({
      items: [
        {
          id: "i1",
          position: { x: 5, y: 5 },
          kind: "armor",
          payload: { material: "cloth", slot: "helm" } as unknown as ItemDefinition["payload"],
        },
      ],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("FR-024") && e.includes("cloth"))).toBe(true);
  });

  it("rejects a keyed door naming an unknown door tier, by name", () => {
    const floor = baseFloor({
      keyedDoors: [{ id: "d1", position: { x: 5, y: 5 }, doorType: "obsidian" }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("FR-024") && e.includes("obsidian"))).toBe(true);
  });

  it("accepts a surviving weapon id, armour material, and door tier", () => {
    const floor = baseFloor({
      items: [
        { id: "i1", position: { x: 5, y: 5 }, kind: "weapon", payload: "diamondSword" },
        { id: "i2", position: { x: 6, y: 5 }, kind: "armor", payload: { material: "plate", slot: "chest" } },
      ],
      keyedDoors: [{ id: "d1", position: { x: 7, y: 5 }, doorType: "gold" }],
    });
    const result = validateFloorDefinition(floor);
    expect(result.errors.some((e) => e.includes("FR-024"))).toBe(false);
  });
});

describe("enemy dodgeChance override (032 C4)", () => {
  const errorsFor = (dodgeChance: number | undefined) =>
    validateFloorDefinition(baseFloor({ enemies: [{ ...enemyAt("e1", 3, 3), dodgeChance }] })).errors.filter((e) =>
      e.includes("dodgeChance"),
    );

  it.each([1.5, -0.1, Number.NaN])("rejects %s, naming the enemy", (v) => {
    expect(errorsFor(v)).toEqual([expect.stringContaining('enemy "e1"')]);
  });

  it.each([0, 0.5, 1, undefined])("accepts %s", (v) => {
    expect(errorsFor(v)).toEqual([]);
  });
});
