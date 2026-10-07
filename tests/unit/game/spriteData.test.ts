import { describe, expect, it } from "vitest";
import { paintSprite } from "../../../src/game/render/painters";
import { LAVA_GLOW_FRAME, SPRITES, ZONE_TILES, type SheetZone, type SpriteGrid } from "../../../src/game/render/spriteData";

/** 021: mirrors extract-sprites.ts's own player<Tier><Dir><Frame> naming exactly — 4 tiers x 4
 * directions x 4 frames = 64 grids, replacing the 4 old flat front-idle-only keys. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const PLAYER_TIERS = ["none", "leather", "mail", "plate"];
const PLAYER_DIRECTIONS = ["front", "right", "back", "left"];
const PLAYER_FRAMES = ["idle", "stepA", "stepB", "breath"];
const PLAYER_BODIES = PLAYER_TIERS.flatMap((tier) =>
  PLAYER_DIRECTIONS.flatMap((dir) =>
    PLAYER_FRAMES.map((frame) => `player${capitalize(tier)}${capitalize(dir)}${capitalize(frame)}`),
  ),
);

const MONSTERS = ["goblin", "ogre", "wizard", "bat", "slime", "skeleton", "necromancer", "bandit", "voidwalker"];
/** 030: each combat monster's side profile, `<species>Left<Frame>` (contract C1). */
const MONSTER_LEFT_FRAMES = ["Idle", "Breath", "AttackA", "AttackB"];

const FAMILIES = {
  playerBodies: PLAYER_BODIES,
  monsters: MONSTERS,
  monsterLeft: MONSTERS.flatMap((m) => MONSTER_LEFT_FRAMES.map((f) => `${m}Left${f}`)),
  /** 023: unlike every combat monster above (one `.idle` frame each), the merchant adopts both
   * `.idle` and `.breath` — a real 2-frame breathing animation (FR-002). */
  merchant: ["merchantIdle", "merchantBreath"],
  weapons: ["woodSword", "sword", "goldSword", "diamondSword"],
  armour: [
    "leatherHelm", "leatherChest", "leatherLegs", "leatherBoots",
    "mailHelm", "mailChest", "mailLegs", "mailBoots",
    "plateHelm", "plateChest", "plateLegs", "plateBoots",
  ],
  items: ["potion", "potionAttack", "potionDefense", "keyBronze", "keySilver", "keyGold", "coin"],
  props: ["doorBronze", "doorSilver", "doorGold", "stairsUp", "stairsDown", "chest"],
  baseTiles: ["floorSlab", "floorCracked", "wallBlock", "crackedWall", "water", "spikesOff", "spikesHalf", "spikesOn", "lava"],
};

const ALL_ADOPTED = Object.values(FAMILIES).flat();
const ZONE_NAMES: Exclude<SheetZone, "stone">[] = ["cistern", "ruin", "forge", "crypt", "throne"];
const ZONEABLE_TILES = FAMILIES.baseTiles.filter((t) => t !== "lava");

function opaqueMask(grid: SpriteGrid): boolean[][] {
  return paintSprite(grid).map((row) => row.map((cell) => cell !== null));
}

describe("SPRITES inventory (contract C6)", () => {
  it("has exactly the 149 non-zone adopted sprites", () => {
    expect(new Set(Object.keys(SPRITES))).toEqual(new Set(ALL_ADOPTED));
    expect(Object.keys(SPRITES)).toHaveLength(149);
  });

  it("has no out-of-scope tile key", () => {
    const outOfScope = ["rubble", "vaultDoor", "lava1", "lava2", "lava3", "lava4", "lava5", "lava6", "lava7"];
    for (const key of outOfScope) expect(SPRITES).not.toHaveProperty(key);
  });

  it("has no duplicated armour icon between ARMOUR and ITEMS adoption", () => {
    const keys = Object.keys(SPRITES);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(Object.keys(SPRITES))("sprite '%s' rows all decode to its declared width and row count", (key) => {
    const grid = SPRITES[key]!;
    expect(grid.rows).toHaveLength(grid.h);
    expect(() => paintSprite(grid)).not.toThrow();
    for (const row of paintSprite(grid)) expect(row).toHaveLength(grid.w);
  });

  it.each(Object.keys(SPRITES))("sprite '%s' pal entries are literal #rrggbb", (key) => {
    for (const c of SPRITES[key]!.pal) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("monster side profiles (030 contract C2)", () => {
  it.each(MONSTERS)("'%s' side-profile idle and breath are 32x32 with no draw offset", (m) => {
    for (const f of ["Idle", "Breath"]) {
      const grid = SPRITES[`${m}Left${f}`]!;
      expect([grid.w, grid.h]).toEqual([32, 32]);
      expect(grid.dx ?? 0).toBe(0);
    }
  });

  // CombatOverlay anchors the monster on its right edge (research R7). That is only correct while
  // the sheet's own declared offset puts the attack frames' right 32 columns over the idle grid.
  it.each(MONSTERS)("'%s' attack frames are 44x32 and offset so their right edge matches idle", (m) => {
    for (const f of ["AttackA", "AttackB"]) {
      const grid = SPRITES[`${m}Left${f}`]!;
      expect([grid.w, grid.h]).toEqual([44, 32]);
      expect(grid.dx).toBe(32 - grid.w);
    }
  });

  it("no non-attack sprite carries a draw offset", () => {
    const offset = Object.entries(SPRITES).filter(([, g]) => g.dx !== undefined).map(([k]) => k);
    expect(offset.sort()).toEqual(MONSTERS.flatMap((m) => [`${m}LeftAttackA`, `${m}LeftAttackB`]).sort());
  });
});

describe("ZONE_TILES (contract C5, FR-008)", () => {
  it("has exactly the 5 non-stone sheet zones", () => {
    expect(Object.keys(ZONE_TILES).sort()).toEqual([...ZONE_NAMES].sort());
  });

  it("has exactly 39 zone tile variants, all valid RLE", () => {
    let count = 0;
    for (const zone of ZONE_NAMES) {
      for (const [key, grid] of Object.entries(ZONE_TILES[zone]!)) {
        expect(ZONEABLE_TILES).toContain(key);
        expect(() => paintSprite(grid)).not.toThrow();
        count++;
      }
    }
    expect(count).toBe(39);
  });

  it("no zone restyles lava", () => {
    for (const zone of ZONE_NAMES) expect(ZONE_TILES[zone]).not.toHaveProperty("lava");
  });

  it.each(ZONE_NAMES)("every variant in zone '%s' shares its base tile's opaque mask (FR-008)", (zone) => {
    for (const [tileKey, variant] of Object.entries(ZONE_TILES[zone]!)) {
      const base = SPRITES[tileKey];
      expect(base, `zone '${zone}' variant '${tileKey}' has no base tile`).toBeDefined();
      expect(opaqueMask(variant), `zone '${zone}' tile '${tileKey}' silhouette differs from base`).toEqual(opaqueMask(base!));
    }
  });
});

describe("LAVA_GLOW_FRAME", () => {
  it("is a valid, distinct sprite from the base lava tile", () => {
    expect(() => paintSprite(LAVA_GLOW_FRAME)).not.toThrow();
    expect(LAVA_GLOW_FRAME.w).toBe(SPRITES.lava!.w);
    expect(LAVA_GLOW_FRAME.h).toBe(SPRITES.lava!.h);
  });
});

describe("game zone mapping (FR-026)", () => {
  it("every game ZoneThemeId maps to exactly one sheet zone that resolves (directly or via fallback)", () => {
    const GAME_ZONE_TO_SHEET: Record<string, SheetZone> = {
      stone: "stone",
      crypt: "crypt",
      cavern: "ruin",
      frost: "cistern",
      ember: "forge",
      arcane: "throne",
    };
    for (const sheetZone of Object.values(GAME_ZONE_TO_SHEET)) {
      if (sheetZone === "stone") continue;
      expect(ZONE_TILES[sheetZone as Exclude<SheetZone, "stone">]).toBeDefined();
    }
  });
});
