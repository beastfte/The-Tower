import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyEnemyPlacement } from "../../../src/domain/floor/validator";
import type { EnemyDefinition, FloorDefinition } from "../../../src/domain/floor/types";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(THIS_DIR, "../../..");
const TOOL_HTML_PATH = join(REPO_ROOT, "tools/tower-mapping-tool/index.html");

/** Extracts one `function <name>(...) { ... }` declaration's exact source text from the tool's
 * HTML by balancing braces from its opening `{`. All five functions this test needs
 * (`posKey`, `tileOpen`, `revealedPathwayPositions`, `bfsReachesTile`,
 * `classifyEnemyPlacement`) are pure — they only touch their own parameters and each other, never
 * `document`/`window`/the artifact's `floors` map — so they can be lifted out and evaluated on
 * their own, without needing the rest of the (DOM-dependent) file. */
function extractFunction(source: string, name: string): string {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found in ${TOOL_HTML_PATH}`);
  let i = source.indexOf("{", start);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(start, i + 1);
}

/** contracts/enemy-classification-contract.md §3: the tool's copy of the classifier MUST agree
 * with the domain's. This loads the tool's actual, current implementation straight out of the
 * HTML file — if someone edits the rule in one place and not the other, this fails. */
function loadToolClassifier(): (floor: unknown, enemy: unknown) => "compulsory" | "optional" {
  const html = readFileSync(TOOL_HTML_PATH, "utf-8");
  const names = ["posKey", "tileOpen", "revealedPathwayPositions", "bfsReachesTile", "classifyEnemyPlacement"];
  const source = names.map((name) => extractFunction(html, name)).join("\n");
  // eslint-disable-next-line no-new-func -- deliberate: evaluating the tool's own extracted source, not user input
  const factory = new Function(`${source}\nreturn classifyEnemyPlacement;`);
  return factory();
}

/** A shared "which tiles are open" grid, converted to each side's own shape (the domain's
 * `Tile[][]` `walkable` grid vs. the tool's `walls[][]`, which is the boolean's negation). */
function buildFixture(openRows: boolean[][], entrance: { x: number; y: number }, exit: { x: number; y: number }, enemies: EnemyDefinition[]) {
  const domainFloor: FloorDefinition = {
    id: "parity",
    grid: openRows.map((row) => row.map((open) => ({ walkable: open }))),
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
    torches: [],
    wallZoneOverrides: [],
  };
  const toolFloor = {
    id: "parity",
    width: openRows[0]!.length,
    height: openRows.length,
    walls: openRows.map((row) => row.map((open) => !open)),
    entrance,
    exit,
    enemies,
    levers: [] as unknown[],
  };
  return { domainFloor, toolFloor };
}

function enemyAt(id: string, x: number, y: number): EnemyDefinition {
  return { id, position: { x, y }, species: "goblin", stats: { damage: 1, defence: 0, hp: 1 } };
}

describe("enemy classification parity (017, contract §3) — domain vs. mapping tool", () => {
  const toolClassify = loadToolClassifier();

  const cases: { name: string; openRows: boolean[][]; entrance: { x: number; y: number }; exit: { x: number; y: number }; enemies: EnemyDefinition[] }[] = [
    {
      name: "walls-sealed corridor enemy",
      openRows: [
        [false, false, false, false, false],
        [true, true, true, true, true],
        [false, false, false, false, false],
      ],
      entrance: { x: 0, y: 1 },
      exit: { x: 4, y: 1 },
      enemies: [enemyAt("e1", 2, 1)],
    },
    {
      name: "open-room center enemy",
      openRows: [
        [true, true, true],
        [true, true, true],
        [true, true, true],
      ],
      entrance: { x: 0, y: 1 },
      exit: { x: 2, y: 1 },
      enemies: [enemyAt("e1", 1, 1)],
    },
    {
      name: "parallel-route enemies",
      openRows: [
        [true, true, true, true, true],
        [true, false, false, false, true],
        [true, true, true, true, true],
      ],
      entrance: { x: 0, y: 1 },
      exit: { x: 4, y: 1 },
      enemies: [enemyAt("top", 2, 0), enemyAt("bottom", 2, 2)],
    },
    {
      name: "series enemies on one corridor",
      openRows: [[true, true, true, true, true, true]],
      entrance: { x: 0, y: 0 },
      exit: { x: 5, y: 0 },
      enemies: [enemyAt("a", 2, 0), enemyAt("b", 3, 0)],
    },
  ];

  for (const testCase of cases) {
    it(`agrees on: ${testCase.name}`, () => {
      const { domainFloor, toolFloor } = buildFixture(testCase.openRows, testCase.entrance, testCase.exit, testCase.enemies);
      for (const enemy of testCase.enemies) {
        const domainResult = classifyEnemyPlacement(domainFloor, enemy);
        const toolResult = toolClassify(toolFloor, enemy);
        expect(toolResult, `enemy "${enemy.id}" in "${testCase.name}"`).toBe(domainResult);
      }
    });
  }
});
