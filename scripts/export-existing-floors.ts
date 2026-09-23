import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOWER } from "../src/data/floors/index";
import { floorDefinitionToExport } from "./floorConversion";
import type { TowerExport } from "./floorConversion";
import type { Tower } from "../src/domain/floor/tower";

/**
 * contracts/tower-export-schema.md's "Bootstrap CLI (repo → tool direction)" (FR-016,
 * research.md #7): reads the live `TOWER` and writes a `TowerExport`-shaped JSON file, so a
 * floor already in the game (authored before this tool existed) can be imported into the
 * tool once and become a normal, tool-managed floor from then on. `order` is set to each
 * floor's index in `TOWER.floors` — no validation gate here, the data is already live,
 * authoritative game content (contract's own "Invariants" section).
 */
export function exportExistingFloors(tower: Tower): TowerExport {
  return {
    floors: tower.floors.map((def, index) => floorDefinitionToExport(def, index)),
  };
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error("Usage: npm run export-existing-floors -- <output-path.json>");
    process.exit(1);
  }
  const towerExport = exportExistingFloors(TOWER);
  writeFileSync(outputPath, JSON.stringify(towerExport, null, 2), "utf-8");
  console.log(`Wrote ${towerExport.floors.length} floor(s) to ${outputPath}`);
}

// Run only when this file is the invoked entry point (`tsx scripts/export-existing-floors.ts
// ...`), not when imported by a test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
