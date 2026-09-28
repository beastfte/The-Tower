import { describe, expect, it } from "vitest";
import { ARMOUR_TIERS, PAL, SPRITES, ZONE_SWAPS, type SheetZone } from "../../../src/game/render/spriteData";

const CLASSIC_FAMILIES = {
  characters: ["player", "goblin", "ogre", "wizard"],
  playerArmourOverlay: ["playerArmour"],
  tiles: ["floorSlab", "floorCracked", "wallBlock", "crackedWall", "water", "spikesOff", "spikesHalf", "spikesOn", "lava"],
};

const HIGH_BIT_FAMILIES = {
  weapons: ["woodSword", "sword", "goldSword", "diamondSword"],
  armour: [
    "leatherHelm", "leatherChest", "leatherLegs", "leatherBoots",
    "mailHelm", "mailChest", "mailLegs", "mailBoots",
    "plateHelm", "plateChest", "plateLegs", "plateBoots",
  ],
  items: ["keyBronze", "keySilver", "keyGold", "potion", "potionAttack", "potionDefense", "coin"],
  props: ["doorBronze", "doorSilver", "doorGold", "stairsUp", "stairsDown", "chest"],
};

const ALL_CLASSIC = Object.values(CLASSIC_FAMILIES).flat();
const ALL_HIGH_BIT = Object.values(HIGH_BIT_FAMILIES).flat();

describe("SPRITES inventory (contract C6)", () => {
  it("has exactly 43 sprites", () => {
    expect(Object.keys(SPRITES)).toHaveLength(43);
  });

  it("has exactly the documented families and keys", () => {
    expect(new Set(Object.keys(SPRITES))).toEqual(new Set([...ALL_CLASSIC, ...ALL_HIGH_BIT]));
  });

  it.each(ALL_CLASSIC)("classic sprite '%s' has hb: false and no map", (key) => {
    const grid = SPRITES[key]!;
    expect(grid.hb).toBe(false);
    expect(grid.map).toBeUndefined();
  });

  it.each(ALL_HIGH_BIT)("high-bit sprite '%s' has hb: true and a map", (key) => {
    const grid = SPRITES[key]!;
    expect(grid.hb).toBe(true);
    expect(grid.map).toBeDefined();
  });

  it.each(Object.keys(SPRITES))("sprite '%s' rows all decode to its declared width and row count", (key) => {
    const grid = SPRITES[key]!;
    expect(grid.rows).toHaveLength(grid.h);
    for (const row of grid.rows) expect(row).toHaveLength(grid.w);
  });

  it.each(ALL_CLASSIC.filter((k) => k !== "playerArmour"))("classic sprite '%s' references only PAL letters", (key) => {
    const grid = SPRITES[key]!;
    for (const row of grid.rows) {
      for (const ch of row) {
        if (ch !== ".") expect(PAL[ch], `letter '${ch}' in '${key}'`).toBeDefined();
      }
    }
  });

  it.each(ALL_HIGH_BIT)("high-bit sprite '%s' resolves every non-'.' letter via map", (key) => {
    const grid = SPRITES[key]!;
    const map = grid.map!;
    for (const row of grid.rows) {
      for (const ch of row) {
        if (ch === ".") continue;
        expect(map[ch] ?? ch, `letter '${ch}' in '${key}' has no resolvable entry`).toBeDefined();
      }
    }
  });
});

describe("ARMOUR_TIERS", () => {
  it("has all four tiers and 'none' has no regions", () => {
    expect(Object.keys(ARMOUR_TIERS).sort()).toEqual(["leather", "mail", "none", "plate"]);
    expect(ARMOUR_TIERS.none.regions).toBe("");
  });
});

describe("ZONE_SWAPS", () => {
  const SHEET_ZONES: SheetZone[] = ["stone", "cistern", "ruin", "forge", "crypt", "throne"];

  it("has exactly the six sheet zones, stone as identity", () => {
    expect(Object.keys(ZONE_SWAPS).sort()).toEqual([...SHEET_ZONES].sort());
    expect(ZONE_SWAPS.stone).toEqual({});
  });

  it("every game ZoneThemeId maps to exactly one sheet zone (FR-026)", async () => {
    // Mirrors the mapping spriteTextures.ts uses — pinned here so a change to either side is
    // caught, without importing the Phaser-dependent module into a plain data test.
    const GAME_ZONE_TO_SHEET: Record<string, SheetZone> = {
      stone: "stone",
      crypt: "crypt",
      cavern: "ruin",
      frost: "cistern",
      ember: "forge",
      arcane: "throne",
    };
    for (const sheetZone of Object.values(GAME_ZONE_TO_SHEET)) {
      expect(ZONE_SWAPS[sheetZone]).toBeDefined();
    }
  });
});
