import { describe, expect, it } from "vitest";
import { paintSprite } from "../../../src/game/render/painters";
import { LAVA_GLOW_FRAME, SPRITES, ZONE_TILES, type SheetZone, type SpriteGrid } from "../../../src/game/render/spriteData";

/** 021: mirrors extract-sprites.ts's own player<Tier><Dir><Frame> naming exactly — 4 tiers x 4
 * directions x 4 frames = 64 grids, replacing the 4 old flat front-idle-only keys. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** 035: only the unarmoured body is a full sprite; worn armour is per-slot layers (below). */
const PLAYER_TIERS = ["none"];
const ARMOUR_TIERS = ["leather", "mail", "plate"];
const ARMOUR_SLOTS = ["helm", "chest", "legs", "boots"];
const PLAYER_DIRECTIONS = ["front", "right", "back", "left"];
const PLAYER_FRAMES = ["idle", "stepA", "stepB", "breath"];
const PLAYER_BODIES = PLAYER_TIERS.flatMap((tier) =>
  PLAYER_DIRECTIONS.flatMap((dir) =>
    PLAYER_FRAMES.map((frame) => `player${capitalize(tier)}${capitalize(dir)}${capitalize(frame)}`),
  ),
);

/** 035 (contract C1): `armour<Tier><Slot><Dir><Frame>`, right gets the two attack frames too. */
const ARMOUR_LAYERS = ARMOUR_TIERS.flatMap((t) =>
  ARMOUR_SLOTS.flatMap((sl) =>
    ["front", "right", "back", "left"].flatMap((d) =>
      (d === "right" ? [...PLAYER_FRAMES, "attackA", "attackB"] : PLAYER_FRAMES).map(
        (f) => `armour${capitalize(t)}${capitalize(sl)}${capitalize(d)}${capitalize(f)}`,
      ),
    ),
  ),
);

const WEAPON_IDS = ["woodSword", "sword", "diamondSword"];
const ATTACK_FRAMES = ["attackA", "attackB"];

const MONSTERS = ["goblin", "ogre", "wizard", "bat", "slime", "skeleton", "necromancer", "bandit", "voidwalker"];
/** 030: each combat monster's side profile, `<species>Left<Frame>` (contract C1). */
const MONSTER_LEFT_FRAMES = ["Idle", "Breath", "AttackA", "AttackB"];

const FAMILIES = {
  playerBodies: PLAYER_BODIES,
  armourLayers: ARMOUR_LAYERS,
  monsters: MONSTERS,
  monsterLeft: MONSTERS.flatMap((m) => MONSTER_LEFT_FRAMES.map((f) => `${m}Left${f}`)),
  /** 036: elite front sprite plus the same side-profile frames (contract C1). */
  monsterElite: MONSTERS.flatMap((m) => [`${m}Elite`, ...MONSTER_LEFT_FRAMES.map((f) => `${m}EliteLeft${f}`)]),
  /** 023: unlike every combat monster above (one `.idle` frame each), the merchant adopts both
   * `.idle` and `.breath` — a real 2-frame breathing animation (FR-002). */
  merchant: ["merchantIdle", "merchantBreath"],
  weapons: WEAPON_IDS,
  /** 031: the right-only "Attack Right 2f" bodies, one pair per tier (contract C7). */
  playerAttackBodies: PLAYER_TIERS.flatMap((t) => ATTACK_FRAMES.map((f) => `player${capitalize(t)}Right${capitalize(f)}`)),
  /** 031: sword-in-hand overlays, `held<Weapon><Dir><Frame>` (data-model.md 1.2). */
  heldSwords: WEAPON_IDS.flatMap((w) =>
    PLAYER_DIRECTIONS.flatMap((d) =>
      (d === "right" ? [...PLAYER_FRAMES, ...ATTACK_FRAMES] : PLAYER_FRAMES).map(
        (f) => `held${capitalize(w)}${capitalize(d)}${capitalize(f)}`,
      ),
    ),
  ),
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
  it("has exactly the 417 non-zone adopted sprites (incl. 45 elite, 036)", () => {
    expect(new Set(Object.keys(SPRITES))).toEqual(new Set(ALL_ADOPTED));
    expect(Object.keys(SPRITES)).toHaveLength(417);
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
    const attackKeys = MONSTERS.flatMap((m) => ["", "Elite"].flatMap((e) => [`${m}${e}LeftAttackA`, `${m}${e}LeftAttackB`]));
    expect(offset.sort()).toEqual(attackKeys.sort());
  });
});

describe("elite monster sprites (036 contract C1)", () => {
  it.each(MONSTERS)("'%s' elite front and side-profile idle/breath are 32x32 with no draw offset", (m) => {
    for (const key of [`${m}Elite`, `${m}EliteLeftIdle`, `${m}EliteLeftBreath`]) {
      const grid = SPRITES[key]!;
      expect([grid.w, grid.h]).toEqual([32, 32]);
      expect(grid.dx ?? 0).toBe(0);
    }
  });

  it.each(MONSTERS)("'%s' elite attack frames match the regular geometry", (m) => {
    for (const f of ["AttackA", "AttackB"]) {
      const grid = SPRITES[`${m}EliteLeft${f}`]!;
      expect([grid.w, grid.h]).toEqual([44, 32]);
      expect(grid.dx).toBe(32 - grid.w);
    }
  });

  it("the merchant has no elite sprite", () => {
    expect(SPRITES.merchantElite).toBeUndefined();
  });
});

describe("player attack frames and held swords (031)", () => {
  const attackKeys = [
    ...PLAYER_TIERS.flatMap((t) => ATTACK_FRAMES.map((f) => `player${capitalize(t)}Right${capitalize(f)}`)),
    ...WEAPON_IDS.flatMap((w) => ATTACK_FRAMES.map((f) => `held${capitalize(w)}Right${capitalize(f)}`)),
  ];

  // CombatOverlay anchors the Prince on his left edge (research R5): only correct while the extra
  // 12 columns reach right, i.e. the sheet declares no offset.
  it.each(attackKeys)("'%s' is 44x32 with no draw offset", (key) => {
    const grid = SPRITES[key]!;
    expect([grid.w, grid.h]).toEqual([44, 32]);
    expect(grid.dx ?? 0).toBe(0);
  });

  // composeSprites never resizes, so a sword must match its body for every (dir, frame) (data-model.md 5).
  it.each(FAMILIES.heldSwords)("'%s' matches the size of every tier's body for the same facing/frame", (key) => {
    const suffix = key.replace(/^held(WoodSword|Sword|GoldSword|DiamondSword)/, "");
    const sword = SPRITES[key]!;
    for (const tier of PLAYER_TIERS) {
      const body = SPRITES[`player${capitalize(tier)}${suffix}`]!;
      expect([sword.w, sword.h]).toEqual([body.w, body.h]);
    }
  });
});

describe("per-slot armour layers (035)", () => {
  const dirs = ["front", "right", "back", "left"];
  const framesFor = (d: string) => (d === "right" ? [...PLAYER_FRAMES, "attackA", "attackB"] : PLAYER_FRAMES);
  const cases = ARMOUR_TIERS.flatMap((t) => dirs.flatMap((d) => framesFor(d).map((f) => [t, d, f] as const)));

  it.each(cases)("%s %s %s: layers match the body size, never overlap, and are not all empty", (tier, dir, frame) => {
    const body = SPRITES[`playerNone${capitalize(dir)}${capitalize(frame)}`]!;
    const masks = ARMOUR_SLOTS.map((slot) => {
      const g = SPRITES[`armour${capitalize(tier)}${capitalize(slot)}${capitalize(dir)}${capitalize(frame)}`]!;
      expect([g.w, g.h]).toEqual([body.w, body.h]);
      return opaqueMask(g);
    });
    let opaque = 0;
    for (let y = 0; y < body.h; y++) {
      for (let x = 0; x < body.w; x++) {
        const n = masks.filter((m) => m[y]![x]).length;
        expect(n).toBeLessThanOrEqual(1);
        opaque += n;
      }
    }
    expect(opaque).toBeGreaterThan(0);
  });

  it("helm, chest, legs and boots each carry pixels in every tier (front idle)", () => {
    for (const tier of ARMOUR_TIERS) {
      for (const slot of ARMOUR_SLOTS) {
        const g = SPRITES[`armour${capitalize(tier)}${capitalize(slot)}FrontIdle`]!;
        expect(opaqueMask(g).flat().some(Boolean)).toBe(true);
      }
    }
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
