import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSync } from "../../../scripts/sync-tower";
import type { FloorExport, TowerExport } from "../../../scripts/floorConversion";
import { TOWER } from "../../../src/data/floors";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

/** A single-floor tower mirroring floor-final's real, already-valid shape (15x15, one
 * solid-walled column at x=7 open only at row 7, a compulsory end-boss as the sole
 * chokepoint) — every invariant this exercises is the same one the real floor-final.ts
 * already satisfies, just built here rather than imported, so this test doesn't depend on
 * (or risk drifting from) that file's own content. */
function buildValidGrid(): boolean[][] {
  const size = 15;
  const walls: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    if (y === 0 || y === size - 1) walls.push(Array(size).fill(true));
    else if (y === 7) walls.push(Array(size).fill(false));
    else walls.push(Array.from({ length: size }, (_, x) => x === 7));
  }
  return walls;
}

function validFloorExport(overrides: Partial<FloorExport> = {}): FloorExport {
  return {
    id: "floor-final",
    order: 0,
    width: 15,
    height: 15,
    walls: buildValidGrid(),
    entrance: { x: 0, y: 7 },
    exit: { x: 14, y: 7 },
    enemies: [
      {
        id: "boss",
        position: { x: 7, y: 7 },
        species: "ogre",
        isEndBoss: true,
      },
    ],
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

function makeTempRepoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "sync-tower-test-"));
  mkdirSync(join(root, "src/data/floors"), { recursive: true });
  // A generated floor file's `import { rowFromPattern } from "./gridHelpers"` needs a real
  // module to resolve at runtime (unlike the type-only FloorDefinition import) — copy the
  // real one in so a generated file can actually be loaded back, not just written.
  writeFileSync(
    join(root, "src/data/floors/gridHelpers.ts"),
    readFileSync(join(THIS_DIR, "../../../src/data/floors/gridHelpers.ts"), "utf-8"),
  );
  return root;
}

describe("runSync — the validate-before-write gate (contracts/sync-cli-contract.md)", () => {
  it("a valid tower export writes the expected floor files and index.ts, ok: true", () => {
    const repoRoot = makeTempRepoRoot();
    const towerExport: TowerExport = { floors: [validFloorExport()] };

    const result = runSync(towerExport, repoRoot);

    expect(result.ok).toBe(true);
    expect(result.writtenFiles).toEqual(["src/data/floors/floor-final.ts", "src/data/floors/index.ts"]);
    expect(existsSync(join(repoRoot, "src/data/floors/floor-final.ts"))).toBe(true);
    expect(existsSync(join(repoRoot, "src/data/floors/index.ts"))).toBe(true);

    const floorSource = readFileSync(join(repoRoot, "src/data/floors/floor-final.ts"), "utf-8");
    expect(floorSource).toContain('export const FLOOR_FINAL: FloorDefinition = {');
    expect(floorSource).toContain('rowFromPattern("###############")');
    expect(floorSource).toContain('"isEndBoss": true');

    const indexSource = readFileSync(join(repoRoot, "src/data/floors/index.ts"), "utf-8");
    expect(indexSource).toContain('import { FLOOR_FINAL } from "./floor-final";');
    expect(indexSource).toContain("createTower([FLOOR_FINAL])");
  });

  it("an export with an unobtainable key writes nothing and reports every problem found", () => {
    const repoRoot = makeTempRepoRoot();
    const towerExport: TowerExport = {
      floors: [
        validFloorExport({
          keyedDoors: [{ id: "door-gold", position: { x: 2, y: 3 }, doorType: "gold" }],
        }),
      ],
    };

    const result = runSync(towerExport, repoRoot);

    expect(result.ok).toBe(false);
    expect(result.errors!.some((e) => e.includes("door-gold") && e.includes("invariant 7"))).toBe(true);
    expect(existsSync(join(repoRoot, "src/data/floors/floor-final.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/data/floors/index.ts"))).toBe(false);
  });

  it("reports problems from multiple floors together in one pass, not just the first found", () => {
    const repoRoot = makeTempRepoRoot();
    const secondFloor = validFloorExport({
      id: "floor-second",
      order: 1,
      // A second compulsory end boss violates "exactly one end boss across the tower".
    });
    const towerExport: TowerExport = { floors: [validFloorExport({ order: 0 }), secondFloor] };

    const result = runSync(towerExport, repoRoot);

    expect(result.ok).toBe(false);
    expect(result.errors!.some((e) => e.includes("expected exactly one end boss"))).toBe(true);
  });

  it("no partial writes: an invalid tower touches none of the repo's real floor files even when passed the real repo root", () => {
    // Uses the actual repo root (this test file's own checkout) but an intentionally invalid
    // export, to prove the gate never writes anything on failure regardless of repoRoot.
    // Targets whichever real floor id happens to be first in the live TOWER — never a
    // hardcoded filename — so this test survives the tower being redesigned/renamed.
    const repoRoot = join(THIS_DIR, "../../..");
    const realFloorId = TOWER.floors[0]!.id;
    const realFloorPath = join(repoRoot, `src/data/floors/${realFloorId}.ts`);
    const before = readFileSync(realFloorPath, "utf-8");

    const result = runSync(
      { floors: [validFloorExport({ id: realFloorId, keyedDoors: [{ id: "d", position: { x: 1, y: 1 }, doorType: "unobtainable" }] })] },
      repoRoot,
    );

    expect(result.ok).toBe(false);
    const after = readFileSync(realFloorPath, "utf-8");
    expect(after).toBe(before);
  });
});
