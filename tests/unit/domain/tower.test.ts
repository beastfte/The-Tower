import { describe, expect, it } from "vitest";
import { createTower, validateTower } from "../../../src/domain/floor/tower";
import type { EnemyDefinition, FloorDefinition } from "../../../src/domain/floor/types";

/** A 15x15 floor with a single solid-walled column at x=7, open only at row 7 — the same
 * "one chokepoint column" shape floor-final.ts and syncTower.test.ts's fixture already use.
 * When `bypassRow` is given, that row is ALSO fully open across every column, giving a second,
 * genuine corridor that lets the player cross from entrance to exit without ever touching the
 * boss's tile. */
function chokepointFloor(bossEnemy: EnemyDefinition, bypassRow?: number): FloorDefinition {
  const size = 15;
  const grid = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => ({
      walkable: y === 7 || y === bypassRow,
    })),
  );
  return {
    id: "floor-final",
    grid,
    entrance: { x: 0, y: 7 },
    exit: { x: 14, y: 7 },
    enemies: [bossEnemy],
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
  };
}

describe("validateTower — end boss must be geometrically unavoidable (017, invariant 5)", () => {
  it("accepts a tower whose end boss's tile is genuinely the only route to the exit", () => {
    const boss: EnemyDefinition = {
      id: "boss",
      position: { x: 7, y: 7 },
      species: "ogre",
      stats: { damage: 6, defence: 4, hp: 30 },
      isEndBoss: true,
    };
    // Only row 7 is open at all — the boss's own tile is the sole crossing point.
    const floor = chokepointFloor(boss);
    const result = validateTower(createTower([floor]));
    expect(result.valid).toBe(true);
  });

  it("rejects a tower whose designated end boss can be walked around", () => {
    const boss: EnemyDefinition = {
      id: "boss",
      position: { x: 7, y: 7 },
      species: "ogre",
      stats: { damage: 6, defence: 4, hp: 30 },
      isEndBoss: true,
    };
    // Row 6 is ALSO fully open now — a second corridor lets the player cross entirely without
    // touching the boss's tile, so it's avoidable even though it's still `isEndBoss: true`.
    const floor = chokepointFloor(boss, 6);
    const result = validateTower(createTower([floor]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invariant 5"))).toBe(true);
  });
});
