import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(THIS_DIR, "../../..");
const TOOL_HTML_PATH = join(REPO_ROOT, "tools/tower-mapping-tool/index.html");

/** Extracts one `<marker> ... }` block's exact source text from the tool's HTML by balancing
 * braces from the first `{` after `marker`. Works for both `function name(...) { ... }` and
 * `const name = { ... };` declarations — same technique
 * `tests/unit/scripts/enemyClassificationParity.test.ts` uses for the classifier functions. */
function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`"${marker}" not found in ${TOOL_HTML_PATH}`);
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

/** Loads the tool's actual, current id-allocation logic straight out of the HTML file (017
 * FR-009/FR-010, research.md R8) — no reimplementation to drift from what ships. */
function loadFreshElementId(): (floor: unknown, kind: string) => string {
  const html = readFileSync(TOOL_HTML_PATH, "utf-8");
  const source = [
    extractBlock(html, "const ELEMENT_KIND_ARRAY_KEY = {"),
    extractBlock(html, "function maxExistingElementSuffix("),
    extractBlock(html, "function freshElementId("),
  ].join("\n");
  // eslint-disable-next-line no-new-func -- deliberate: evaluating the tool's own extracted source
  const factory = new Function(`${source}\nreturn freshElementId;`);
  return factory();
}

function floorWithItems(id: string, itemIds: string[]) {
  return {
    id,
    items: itemIds.map((itemId) => ({ id: itemId, position: { x: 0, y: 0 }, kind: "potion" })),
    enemies: [] as { id: string }[],
  };
}

describe("mapping tool element id allocation (017 US3, FR-009/FR-010, SC-005)", () => {
  const freshElementId = loadFreshElementId();

  it("never reuses an id already present on the floor for that kind, after a simulated reload", () => {
    // Simulates: page loads, floor arrives from persistence already containing ids up to 19 —
    // exactly the condition that used to collide with a counter freshly reset to 1.
    const floor = floorWithItems("floor-2", Array.from({ length: 19 }, (_, i) => `floor-2-item-${i + 1}`));
    const nextId = freshElementId(floor, "item");
    expect(nextId).toBe("floor-2-item-20");
    expect(floor.items.some((it) => it.id === nextId)).toBe(false);
  });

  it("starts a genuinely new floor/kind pair from 1", () => {
    const floor = floorWithItems("floor-9", []);
    expect(freshElementId(floor, "item")).toBe("floor-9-item-1");
  });

  it("keeps numbering independent across different floors", () => {
    const floorA = floorWithItems("floor-a", ["floor-a-item-1", "floor-a-item-2"]);
    const floorB = floorWithItems("floor-b", []);
    expect(freshElementId(floorA, "item")).toBe("floor-a-item-3");
    expect(freshElementId(floorB, "item")).toBe("floor-b-item-1"); // unaffected by floor-a's numbering
  });

  it("keeps numbering independent across different kinds on the same floor", () => {
    const floor = floorWithItems("floor-c", ["floor-c-item-1", "floor-c-item-2", "floor-c-item-3"]);
    floor.enemies = [{ id: "floor-c-enemy-1" }];
    expect(freshElementId(floor, "enemy")).toBe("floor-c-enemy-2"); // unaffected by the item numbering
  });

  it("reflects newly added elements immediately, with no separate counter to go stale", () => {
    // Regression guard for the original bug's root cause: any cached/seeded-once counter would
    // fail this, because it would never notice the floor's contents changed out from under it
    // (e.g. after an import replaced the floor's data with something numbered much higher).
    const floor = floorWithItems("floor-d", []);
    const first = freshElementId(floor, "item");
    floor.items.push({ id: first, position: { x: 0, y: 0 }, kind: "potion" });
    expect(freshElementId(floor, "item")).toBe("floor-d-item-2");

    // Simulate an import replacing this floor's items with data numbered much higher.
    floor.items = [{ id: "floor-d-item-50", position: { x: 0, y: 0 }, kind: "potion" }];
    expect(freshElementId(floor, "item")).toBe("floor-d-item-51");
  });
});
