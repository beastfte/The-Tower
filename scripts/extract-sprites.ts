/**
 * One-shot generator: decodes the reference sprite sheet's bundled sprite library and writes
 * src/game/render/spriteData.ts. The reference HTML lives outside this repo (user's choice), so
 * this script — not a build step — is how its art gets into version control (research R2).
 *
 * Usage: npx tsx scripts/extract-sprites.ts "<path to reference sheet .html>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const TARGET_UUID = "c3afcadb-fda3-4264-a1d0-ce7f68a0d6ff";
const OUTPUT_PATH = "src/game/render/spriteData.ts";

interface RawGrid {
  length: number;
  hb?: boolean;
  map?: Record<string, string | string[]>;
  [index: number]: string[];
}

interface SpriteGridOut {
  w: number;
  h: number;
  rows: string[];
  hb: boolean;
  map?: Record<string, string | string[]>;
}

function fail(message: string): never {
  console.error(`extract-sprites: ${message}`);
  process.exit(1);
}

function loadTowerSprites(htmlPath: string): { TS: Record<string, unknown>; C: Record<string, string> } {
  const html = readFileSync(htmlPath, "utf8");
  const manifestMatch = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
  if (!manifestMatch) fail("no <script type=\"__bundler/manifest\"> block found in the reference HTML");
  const manifest = JSON.parse(manifestMatch![1]!) as Record<string, { mime: string; compressed: boolean; data: string }>;
  const entry = manifest[TARGET_UUID];
  if (!entry) fail(`manifest has no asset ${TARGET_UUID}`);
  if (!entry.compressed) fail(`asset ${TARGET_UUID} is not marked compressed`);
  const src = gunzipSync(Buffer.from(entry.data, "base64")).toString("utf8");

  const window: Record<string, unknown> = {};
  new Function("window", src)(window);
  const TS = window.TowerSprites as Record<string, unknown> | undefined;
  if (!TS) fail("decoded asset did not set window.TowerSprites");

  const cMatch = src.match(/var C = (\{[\s\S]*?\});/);
  if (!cMatch) fail("could not find the high-bit palette (`var C = {...}`) in the decoded source");
  const C = new Function(`return ${cMatch![1]}`)() as Record<string, string>;

  return { TS: TS!, C };
}

function toSpriteGrid(grid: RawGrid, expectSize: number, name: string): SpriteGridOut {
  const h = grid.length;
  const w = (grid[0] as unknown as string[]).length;
  if (h !== expectSize || w !== expectSize) {
    fail(`sprite '${name}' is ${w}x${h}, expected ${expectSize}x${expectSize}`);
  }
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    const row = grid[y] as unknown as string[];
    if (row.length !== w) fail(`sprite '${name}' row ${y} has ${row.length} cells, expected ${w}`);
    // One character per pixel — not run-length. The sheet's alphabet includes digit characters
    // ('1'/'2'/'3' as map keys on several hb sprites), which makes a "<count><char>" RLE decode
    // genuinely ambiguous (greedy digit-run parsing can't tell where the count ends and a
    // digit-valued char begins). Rows are short enough (<=32) that RLE buys nothing anyway.
    rows.push(row.join(""));
  }
  const hb = Boolean(grid.hb);
  const out: SpriteGridOut = { w, h, rows, hb };
  if (hb) out.map = grid.map ?? {};
  return out;
}

function validateClassic(name: string, grid: SpriteGridOut, pal: Record<string, string>): void {
  for (const row of grid.rows) {
    for (const ch of row) {
      if (ch !== "." && !(ch in pal)) fail(`classic sprite '${name}' uses letter '${ch}' not present in PAL`);
    }
  }
}

function validateHighBit(name: string, grid: SpriteGridOut, cPal: Record<string, string>): void {
  const map = grid.map ?? {};
  for (const row of grid.rows) {
    for (const ch of row) {
      if (ch === ".") continue;
      const v = map[ch] ?? ch;
      if (Array.isArray(v)) continue;
      if (v.startsWith("#")) continue;
      if (!(v in cPal)) fail(`high-bit sprite '${name}' letter '${ch}' resolves to unknown key '${v}'`);
    }
  }
}

function main(): void {
  const htmlPath = process.argv[2];
  if (!htmlPath) fail("usage: extract-sprites.ts <path-to-reference-sheet.html>");
  const { TS, C } = loadTowerSprites(htmlPath!);

  // The sheet's own PAL carries a "." -> null placeholder entry (the transparent marker is
  // handled structurally, never looked up) — drop it so PAL is genuinely letter -> colour.
  const rawPal = TS.PAL as Record<string, string | null>;
  const PAL: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawPal)) if (k !== "." && v != null) PAL[k] = v;
  const CHARS = TS.CHARS as Record<string, { front: RawGrid; armour?: { front: RawGrid } }>;
  const WEAPONS = TS.WEAPONS as Record<string, RawGrid>;
  const ARMOUR = TS.ARMOUR as Record<string, RawGrid>;
  const ITEMS = TS.ITEMS as Record<string, RawGrid>;
  const PROPS = TS.PROPS as Record<string, RawGrid>;
  const TILES = TS.TILES as Record<string, RawGrid>;
  const TIERS = TS.TIERS as Record<string, { label: string; regions: string; mid?: string; dark?: string; accent?: string }>;
  const ZONES = TS.ZONES as Record<string, { swap: Record<string, string> }>;

  const sprites: Record<string, SpriteGridOut> = {};

  const classicChars = ["player", "goblin", "ogre", "wizard"];
  for (const name of classicChars) {
    const grid = toSpriteGrid(CHARS[name]!.front, 32, name);
    validateClassic(name, grid, PAL);
    sprites[name] = grid;
  }
  // Worn-armour overlay: letters are tier region codes, not direct PAL keys — skip the PAL check.
  const playerArmourGrid = toSpriteGrid(CHARS.player!.armour!.front, 32, "playerArmour");
  sprites.playerArmour = playerArmourGrid;

  const tileNames = ["floorSlab", "floorCracked", "wallBlock", "crackedWall", "water", "spikesOff", "spikesHalf", "spikesOn", "lava"];
  for (const name of tileNames) {
    const grid = toSpriteGrid(TILES[name]!, 16, name);
    validateClassic(name, grid, PAL);
    sprites[name] = grid;
  }

  const weaponNames = ["woodSword", "sword", "goldSword", "diamondSword"];
  for (const name of weaponNames) {
    const grid = toSpriteGrid(WEAPONS[name]!, 16, name);
    validateHighBit(name, grid, C);
    sprites[name] = grid;
  }

  for (const name of Object.keys(ARMOUR)) {
    const grid = toSpriteGrid(ARMOUR[name]!, 16, name);
    validateHighBit(name, grid, C);
    sprites[name] = grid;
  }

  const itemNames = ["keyBronze", "keySilver", "keyGold", "potion", "potionAttack", "potionDefense", "coin"];
  for (const name of itemNames) {
    const grid = toSpriteGrid(ITEMS[name]!, 16, name);
    validateHighBit(name, grid, C);
    sprites[name] = grid;
  }

  for (const name of Object.keys(PROPS)) {
    const grid = toSpriteGrid(PROPS[name]!, 32, name);
    validateHighBit(name, grid, C);
    sprites[name] = grid;
  }

  const expectedCount = classicChars.length + 1 + tileNames.length + weaponNames.length + Object.keys(ARMOUR).length + itemNames.length + Object.keys(PROPS).length;
  if (Object.keys(sprites).length !== expectedCount || expectedCount !== 43) {
    fail(`expected 43 sprites, extracted ${Object.keys(sprites).length}`);
  }

  const armourTiers: Record<string, { label: string; regions: string; mid?: string; dark?: string; accent?: string }> = {};
  for (const [id, t] of Object.entries({ none: TIERS.none!, leather: TIERS.leather!, mail: TIERS.mail!, plate: TIERS.plate! })) {
    armourTiers[id] = { label: t.label, regions: t.regions, mid: t.mid, dark: t.dark, accent: t.accent };
  }

  const sheetZones = ["stone", "cistern", "ruin", "forge", "crypt", "throne"];
  const zoneSwaps: Record<string, Record<string, string>> = {};
  for (const z of sheetZones) zoneSwaps[z] = ZONES[z]!.swap;

  const banner = `/**
 * GENERATED FILE — do not hand-edit. Produced by scripts/extract-sprites.ts from the reference
 * sprite sheet ("The Tower - Sprite Sheet (7).html", section 10 "THE SHEET"). Regenerate with:
 *   npx tsx scripts/extract-sprites.ts "<path to reference sheet.html>"
 */
`;

  const body = `
export interface SpriteGrid {
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
  readonly hb: boolean;
  readonly map?: Readonly<Record<string, string | readonly string[]>>;
}

export type SheetZone = "stone" | "cistern" | "ruin" | "forge" | "crypt" | "throne";

export type ArmourTierId = "none" | "leather" | "mail" | "plate";

export interface ArmourTierDef {
  readonly label: string;
  readonly regions: string;
  readonly mid?: string;
  readonly dark?: string;
  readonly accent?: string;
}

export const PAL: Readonly<Record<string, string>> = ${JSON.stringify(PAL, null, 2)};

export const C: Readonly<Record<string, string>> = ${JSON.stringify(C, null, 2)};

export const ARMOUR_TIERS: Readonly<Record<ArmourTierId, ArmourTierDef>> = ${JSON.stringify(armourTiers, null, 2)};

export const ZONE_SWAPS: Readonly<Record<SheetZone, Readonly<Record<string, string>>>> = ${JSON.stringify(zoneSwaps, null, 2)};

/** Not a sheet sprite (research R9) — promotes lava's own ramp one step for its glow frame. */
export const LAVA_GLOW_SWAP: Readonly<Record<string, string>> = { x: "o", o: "f" };

export const SPRITES: Readonly<Record<string, SpriteGrid>> = ${JSON.stringify(sprites, null, 2)};
`;

  writeFileSync(OUTPUT_PATH, banner + body, "utf8");
  console.log(`extract-sprites: wrote ${Object.keys(sprites).length} sprites to ${OUTPUT_PATH}`);
}

main();
