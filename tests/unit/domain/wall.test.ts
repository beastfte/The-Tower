import { describe, expect, it } from "vitest";
import {
  CRACKED_WALL_BREAK_THRESHOLD,
  findCrackedWallAt,
  isWallBroken,
  resolveBrokenWallPositions,
  resolveWallZone,
} from "../../../src/domain/floor/wall";
import { applyWallCollision } from "../../../src/domain/floor/floorState";
import { emptyFloorProgress } from "../../../src/domain/character/save";
import type {
  CrackedWallDefinition,
  FloorDefinition,
  WallZoneOverride,
} from "../../../src/domain/floor/types";
import type { FloorProgress } from "../../../src/domain/character/save";

function makeFloor(
  crackedWalls: CrackedWallDefinition[],
  wallZoneOverrides: WallZoneOverride[] = [],
): FloorDefinition {
  return {
    id: "f1",
    grid: [[{ walkable: true }, { walkable: false }]],
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
    crackedWalls,
    wallZoneOverrides,
  };
}

describe("isWallBroken", () => {
  it("is not broken at exactly the threshold", () => {
    expect(isWallBroken(CRACKED_WALL_BREAK_THRESHOLD)).toBe(false);
  });

  it("is broken one past the threshold", () => {
    expect(isWallBroken(CRACKED_WALL_BREAK_THRESHOLD + 1)).toBe(true);
  });
});

describe("findCrackedWallAt", () => {
  const wall: CrackedWallDefinition = { id: "cw1", position: { x: 1, y: 0 } };

  it("finds a cracked wall at its position", () => {
    const floor = makeFloor([wall]);
    expect(findCrackedWallAt(floor, { x: 1, y: 0 })).toBe(wall);
  });

  it("returns undefined when no cracked wall is at a position", () => {
    const floor = makeFloor([wall]);
    expect(findCrackedWallAt(floor, { x: 0, y: 0 })).toBeUndefined();
  });
});

describe("resolveBrokenWallPositions", () => {
  it("excludes a wall at or below the threshold and includes one past it", () => {
    const floor = makeFloor([
      { id: "cw-intact", position: { x: 1, y: 0 } },
      { id: "cw-broken", position: { x: 2, y: 0 } },
    ]);
    const hitCounts = {
      "cw-intact": CRACKED_WALL_BREAK_THRESHOLD,
      "cw-broken": CRACKED_WALL_BREAK_THRESHOLD + 1,
    };
    expect(resolveBrokenWallPositions(floor, hitCounts)).toEqual([{ x: 2, y: 0 }]);
  });

  it("treats an absent hit count as 0 (never broken)", () => {
    const floor = makeFloor([{ id: "cw1", position: { x: 1, y: 0 } }]);
    expect(resolveBrokenWallPositions(floor, {})).toEqual([]);
  });
});

describe("resolveWallZone", () => {
  it("falls back to the floor's own zone when no override exists", () => {
    const floor = { ...makeFloor([]), zone: "crypt" as const };
    expect(resolveWallZone(floor, { x: 1, y: 0 })).toBe("crypt");
  });

  it("falls back to stone when neither an override nor a floor zone is set", () => {
    const floor = makeFloor([]);
    expect(resolveWallZone(floor, { x: 1, y: 0 })).toBe("stone");
  });

  it("uses a matching override instead of the floor's own zone", () => {
    const floor = {
      ...makeFloor([], [{ position: { x: 1, y: 0 }, zone: "ember" as const }]),
      zone: "crypt" as const,
    };
    expect(resolveWallZone(floor, { x: 1, y: 0 })).toBe("ember");
  });

  it("ignores an override at a different position", () => {
    const floor = makeFloor([], [{ position: { x: 0, y: 0 }, zone: "ember" as const }]);
    expect(resolveWallZone(floor, { x: 1, y: 0 })).toBe("stone");
  });
});

describe("applyWallCollision", () => {
  const wall: CrackedWallDefinition = { id: "cw1", position: { x: 1, y: 0 } };

  it("increments a fresh wall's hit count from 0 to 1", () => {
    const progress = emptyFloorProgress("f1", { x: 0, y: 0 });
    const next = applyWallCollision(progress, wall);
    expect(next.crackedWallHitCounts).toEqual({ cw1: 1 });
  });

  it("increments only the target wall's id, leaving the rest of FloorProgress untouched", () => {
    const progress = {
      ...emptyFloorProgress("f1", { x: 0, y: 0 }),
      crackedWallHitCounts: { "other-wall": 3 },
      defeatedEnemyIds: ["some-enemy"],
    };
    const next = applyWallCollision(progress, wall);
    expect(next.crackedWallHitCounts).toEqual({ "other-wall": 3, cw1: 1 });
    expect(next.defeatedEnemyIds).toEqual(["some-enemy"]);
  });

  it("keeps incrementing past the break threshold (every collision counts)", () => {
    let progress: FloorProgress = {
      ...emptyFloorProgress("f1", { x: 0, y: 0 }),
      crackedWallHitCounts: { cw1: 5 },
    };
    progress = applyWallCollision(progress, wall);
    expect(progress.crackedWallHitCounts.cw1).toBe(6);
  });
});
