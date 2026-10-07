import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPalette, findRemovedEntries, readEmbeddedPalette, syncPalette, type PaletteManifest } from "../../../scripts/sync-tool-palette";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(THIS_DIR, "../../..");
const TOOL_HTML_PATH = join(REPO_ROOT, "tools/tower-mapping-tool/index.html");

/** FR-019: the drift check this test suite gives the project — if `buildPalette()` (derived
 * from the game's real source catalogs) ever stops matching the tool's currently-embedded
 * palette, someone changed a catalog without running `npm run sync-tool-palette`. */
describe("sync-tool-palette — palette generation matches the game's source catalogs (FR-019)", () => {
  it("buildPalette() matches the palette currently embedded in the real tool HTML", () => {
    const html = readFileSync(TOOL_HTML_PATH, "utf-8");
    const embedded = readEmbeddedPalette(html);
    expect(buildPalette()).toEqual(embedded);
  });

  it("carries each species' default dodge chance as part of its baseline (032 C5)", () => {
    for (const m of buildPalette().monsters) expect(m.baseline.dodgeChance).toBeGreaterThanOrEqual(0.02);
  });

  it("includes every monster species, weapon, armor material/slot, door/key tier, lever effect kind, item kind, and hazard kind the game currently defines", () => {
    const palette = buildPalette();
    expect(palette.monsters.map((m) => m.id).sort()).toEqual([
      "bandit", "bat", "goblin", "necromancer", "ogre", "skeleton", "slime", "voidwalker", "wizard",
    ]);
    expect(palette.weapons.map((w) => w.id).sort()).toEqual(["diamondSword", "goldSword", "sword", "woodSword"]);
    expect(palette.armorMaterials.sort()).toEqual(["leather", "mail", "plate"]);
    expect(palette.armorSlots.sort()).toEqual(["boots", "chest", "helm", "legs"]);
    expect(palette.doorKeyTiers.sort()).toEqual(["bronze", "gold", "silver"]);
    expect(palette.leverEffectKinds.sort()).toEqual(["deactivateTraps", "revealPathway", "unlockDoor"]);
    expect(palette.itemKinds.map((k) => k.id).sort()).toEqual(
      ["armor", "chest", "currency", "key", "loot", "potion", "potionAttack", "potionDefense", "weapon"].sort(),
    );
    expect(palette.hazardKinds.map((h) => h.id).sort()).toEqual(["lava", "spike", "water"]);
  });

  it("every item kind and hazard kind has a non-empty display name", () => {
    const palette = buildPalette();
    for (const k of [...palette.itemKinds, ...palette.hazardKinds]) {
      expect(k.name, `expected a display name for "${k.id}"`).toBeTruthy();
    }
  });
});

/** 020 research R7: MONSTER_COLOR and MONSTER_GLYPH are hand-maintained (not part of the
 * generated PALETTE block), and previously had zero test coverage — a missing entry rendered
 * a grey circle or a duplicate letter rather than failing anything. This closes that gap. */
describe("MONSTER_COLOR / MONSTER_GLYPH — hand-maintained, but completeness is checked", () => {
  function readHandMaintainedMonsterMap(html: string, constName: "MONSTER_COLOR" | "MONSTER_GLYPH"): Record<string, string> {
    const match = html.match(new RegExp(`const ${constName} = (\\{[\\s\\S]*?\\});`));
    if (!match) throw new Error(`Could not find "const ${constName} = ...;" in the tool HTML`);
    return new Function(`"use strict"; return (${match[1]});`)() as Record<string, string>;
  }

  it("has one MONSTER_COLOR and one MONSTER_GLYPH entry per species in the palette, with no duplicate glyph", () => {
    const html = readFileSync(TOOL_HTML_PATH, "utf-8");
    const speciesIds = buildPalette().monsters.map((m) => m.id).sort();
    const color = readHandMaintainedMonsterMap(html, "MONSTER_COLOR");
    const glyph = readHandMaintainedMonsterMap(html, "MONSTER_GLYPH");

    expect(Object.keys(color).sort()).toEqual(speciesIds);
    expect(Object.keys(glyph).sort()).toEqual(speciesIds);

    const glyphValues = Object.values(glyph);
    expect(new Set(glyphValues).size, "no two species may share a glyph").toBe(glyphValues.length);
  });
});

describe("findRemovedEntries — FR-020's repo-side refuse-and-report check", () => {
  const base: PaletteManifest = {
    monsters: [{ id: "goblin", name: "Goblin", baseline: { damage: 4, defence: 1, hp: 12, dodgeChance: 0.1 } }],
    weapons: [{ id: "sword", name: "Sword" }],
    armorMaterials: ["cloth"],
    armorSlots: ["helm"],
    doorKeyTiers: ["bronze", "silver", "gold"],
    leverEffectKinds: ["unlockDoor"],
    itemKinds: [{ id: "currency", name: "Currency" }],
    hazardKinds: [{ id: "lava", name: "Lava tile" }],
  };

  it("reports nothing when nothing disappears (an addition is fine)", () => {
    const withAddition: PaletteManifest = {
      ...base,
      monsters: [...base.monsters, { id: "ogre", name: "Ogre", baseline: { damage: 6, defence: 4, hp: 30, dodgeChance: 0.1 } }],
    };
    expect(findRemovedEntries(base, withAddition)).toEqual([]);
  });

  it("reports a monster species removed from the source catalog", () => {
    const withoutGoblin: PaletteManifest = { ...base, monsters: [] };
    expect(findRemovedEntries(base, withoutGoblin)).toEqual([`monsters: "goblin"`]);
  });

  it("reports a door/key tier removed from the source catalog", () => {
    const withoutGold: PaletteManifest = { ...base, doorKeyTiers: ["bronze", "silver"] };
    expect(findRemovedEntries(base, withoutGold)).toEqual([`doorKeyTiers: "gold"`]);
  });

  it("reports an item kind removed from the source catalog", () => {
    const withoutCurrency: PaletteManifest = { ...base, itemKinds: [] };
    expect(findRemovedEntries(base, withoutCurrency)).toEqual([`itemKinds: "currency"`]);
  });

  it("reports a hazard kind removed from the source catalog", () => {
    const withoutLava: PaletteManifest = { ...base, hazardKinds: [] };
    expect(findRemovedEntries(base, withoutLava)).toEqual([`hazardKinds: "lava"`]);
  });

  it("reports every removal together across multiple categories, not just the first", () => {
    const strippedDown: PaletteManifest = {
      monsters: [],
      weapons: [],
      armorMaterials: [],
      armorSlots: base.armorSlots,
      doorKeyTiers: base.doorKeyTiers,
      leverEffectKinds: base.leverEffectKinds,
      itemKinds: [],
      hazardKinds: base.hazardKinds,
    };
    const removed = findRemovedEntries(base, strippedDown);
    expect(removed).toEqual(
      expect.arrayContaining([`monsters: "goblin"`, `weapons: "sword"`, `armorMaterials: "cloth"`, `itemKinds: "currency"`]),
    );
    expect(removed).toHaveLength(4);
  });
});

describe("syncPalette — refuses to write when a removal is detected (FR-020)", () => {
  function scratchCopyOfToolHtml(): string {
    const dir = mkdtempSync(join(tmpdir(), "sync-tool-palette-test-"));
    const scratchPath = join(dir, "index.html");
    writeFileSync(scratchPath, readFileSync(TOOL_HTML_PATH, "utf-8"), "utf-8");
    return scratchPath;
  }

  it("is a no-op (ok, not changed) when run twice in a row against an up-to-date palette", () => {
    const scratchPath = scratchCopyOfToolHtml();
    const first = syncPalette(scratchPath);
    expect(first.ok).toBe(true);
    expect(first.changed).toBe(false);
  });

  it("refuses to write and reports the removed entry when the embedded palette has something buildPalette() no longer produces", () => {
    const scratchPath = scratchCopyOfToolHtml();
    const before = readFileSync(scratchPath, "utf-8");
    const withFakeMonster = before.replace(
      `"monsters": [`,
      `"monsters": [\n          { "id": "totally-fake-species", "name": "Fake", "baseline": { "damage": 1, "defence": 1, "hp": 1 } },`,
    );
    expect(withFakeMonster).not.toBe(before);
    writeFileSync(scratchPath, withFakeMonster, "utf-8");

    const result = syncPalette(scratchPath);
    expect(result.ok).toBe(false);
    expect(result.removed).toEqual([`monsters: "totally-fake-species"`]);

    const after = readFileSync(scratchPath, "utf-8");
    expect(after).toBe(withFakeMonster);
  });
});
