import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateFloorDefinition } from "../src/domain/floor/validator";
import { createTower, validateTower } from "../src/domain/floor/tower";
import { floorExportToDefinition, wallsToPatternRows, type TowerExport, type FloorExport } from "./floorConversion";
import type { FloorDefinition } from "../src/domain/floor/types";

/** contracts/sync-cli-contract.md: reads a TowerExport JSON file, validates it with the
 * existing src/domain/floor validators (data-model.md's "Validation Rules" — unmodified),
 * and only if every check passes, regenerates src/data/floors/*.ts. No partial writes. */

export interface SyncResult {
  ok: boolean;
  writtenFiles?: string[];
  errors?: string[];
}

function constNameFor(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function posLiteral(p: { x: number; y: number }): string {
  return `{ x: ${p.x}, y: ${p.y} }`;
}

/** Nested arrays (enemies/items/etc.) are serialized via JSON.stringify — valid TS object/
 * array literal syntax, just with quoted keys. Simpler and just as correct as a bespoke
 * pretty-printer for every one of FloorDefinition's several placed-element shapes; only the
 * grid (research.md #4) and the top-level entrance/exit need their own hand-picked format to
 * keep a synced floor file's grid readable/diffable like a hand-authored one. */
function arrayField(name: string, value: unknown, indent = "  "): string {
  const json = JSON.stringify(value, null, 2);
  const reindented = json.split("\n").join("\n" + indent);
  return `${indent}${name}: ${reindented},`;
}

function serializeFloorFile(fe: FloorExport, def: FloorDefinition): string {
  const constName = constNameFor(fe.id);
  const gridRows = wallsToPatternRows(fe.walls)
    .map((row) => `    rowFromPattern(${JSON.stringify(row)}),`)
    .join("\n");

  const lines = [
    `import type { FloorDefinition } from "../../domain/floor/types";`,
    `import { rowFromPattern } from "./gridHelpers";`,
    ``,
    `export const ${constName}: FloorDefinition = {`,
    `  id: ${JSON.stringify(def.id)},`,
    `  grid: [`,
    gridRows,
    `  ],`,
    `  entrance: ${posLiteral(def.entrance)},`,
    `  exit: ${posLiteral(def.exit)},`,
    arrayField("enemies", def.enemies),
    arrayField("items", def.items),
    arrayField("keyedDoors", def.keyedDoors),
    arrayField("hazardTiles", def.hazardTiles),
    arrayField("spikePits", def.spikePits),
    arrayField("lavaTiles", def.lavaTiles),
    arrayField("levers", def.levers),
    arrayField("waterTiles", def.waterTiles),
    arrayField("crackedWalls", def.crackedWalls),
    arrayField("torches", def.torches),
  ];
  if (def.zone) lines.push(`  zone: ${JSON.stringify(def.zone)},`);
  lines.push(arrayField("wallZoneOverrides", def.wallZoneOverrides));
  lines.push(`};`, ``);
  return lines.join("\n");
}

function serializeIndexFile(entries: { id: string; constName: string }[]): string {
  const imports = entries.map((e) => `import { ${e.constName} } from "./${e.id}";`).join("\n");
  const arrayLine = entries.map((e) => e.constName).join(", ");
  return [
    `import { createTower } from "../../domain/floor/tower";`,
    imports,
    ``,
    `/** The tower's ordered floor list (FR-001), registering every authored floor. */`,
    `export const TOWER = createTower([${arrayLine}]);`,
    ``,
  ].join("\n");
}

/** The validate-then-write gate, factored out from `main()` so it's directly unit-testable
 * against a scratch `repoRoot` (never the real repo) instead of only through a CLI process. */
export function runSync(towerExport: TowerExport, repoRoot: string): SyncResult {
  const sorted = [...towerExport.floors].sort((a, b) => a.order - b.order);
  const definitions = sorted.map(floorExportToDefinition);

  const errors: string[] = [];
  for (const def of definitions) {
    const result = validateFloorDefinition(def);
    if (!result.valid) errors.push(...result.errors);
  }
  const towerValidation = validateTower(createTower(definitions));
  if (!towerValidation.valid) errors.push(...towerValidation.errors);

  if (errors.length > 0) return { ok: false, errors };

  const writtenFiles: string[] = [];
  const entries: { id: string; constName: string }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const fe = sorted[i]!;
    const def = definitions[i]!;
    entries.push({ id: fe.id, constName: constNameFor(fe.id) });
    const relPath = `src/data/floors/${fe.id}.ts`;
    writeFileSync(join(repoRoot, relPath), serializeFloorFile(fe, def), "utf-8");
    writtenFiles.push(relPath);
  }
  writeFileSync(join(repoRoot, "src/data/floors/index.ts"), serializeIndexFile(entries), "utf-8");
  writtenFiles.push("src/data/floors/index.ts");

  return { ok: true, writtenFiles };
}

function main(): void {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run sync-tower -- <path-to-export.json>");
    process.exit(1);
  }
  const towerExport = JSON.parse(readFileSync(filePath, "utf-8")) as TowerExport;
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const result = runSync(towerExport, repoRoot);

  if (result.ok) {
    const floorCount = result.writtenFiles!.length - 1; // exclude index.ts
    console.log(`Synced ${floorCount} floor(s):`);
    for (const f of result.writtenFiles!) console.log(`  ${f}`);
    process.exit(0);
  } else {
    console.log(`Sync aborted — ${result.errors!.length} problem(s) found, no files written:`);
    for (const e of result.errors!) console.log(`  ${e}`);
    process.exit(1);
  }
}

// Run only when this file is the invoked entry point (`tsx scripts/sync-tower.ts ...`), not
// when imported by a test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
