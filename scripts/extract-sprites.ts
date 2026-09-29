/**
 * One-shot generator: decodes the reference sprite sheet's bundled sprite library and writes
 * src/game/render/spriteData.ts. The reference HTML lives outside this repo (user's choice), so
 * this script — not a build step — is how its art gets into version control (research R2).
 *
 * Usage: npx tsx scripts/extract-sprites.ts "<path to reference sheet.html>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const OUTPUT_PATH = "src/game/render/spriteData.ts";
const AL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RLE = /(\d+)(.)/g;

interface RawGrid {
  w: number;
  h: number;
  pal: string[];
  rows: string[];
}

function fail(message: string): never {
  console.error(`extract-sprites: ${message}`);
  process.exit(1);
}

/** Asset UUIDs are per-revision (research R10) — a pinned one breaks on every new sheet. Scan
 * every manifest entry and identify the sprite library by what it defines, not by name. */
function loadTowerSprites(htmlPath: string): Record<string, unknown> {
  const html = readFileSync(htmlPath, "utf8");
  const manifestMatch = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
  if (!manifestMatch) fail("no <script type=\"__bundler/manifest\"> block found in the reference HTML");
  const manifest = JSON.parse(manifestMatch![1]!) as Record<string, { mime: string; compressed: boolean; data: string }>;

  const matches: { uuid: string; TS: Record<string, unknown> }[] = [];
  for (const [uuid, entry] of Object.entries(manifest)) {
    if (!entry.compressed) continue;
    let src: string;
    try {
      src = gunzipSync(Buffer.from(entry.data, "base64")).toString("utf8");
    } catch {
      continue;
    }
    const window: Record<string, unknown> = {};
    try {
      new Function("window", src)(window);
    } catch {
      continue;
    }
    if (window.TowerSprites) matches.push({ uuid, TS: window.TowerSprites as Record<string, unknown> });
  }

  if (matches.length === 0) fail("no manifest asset defines window.TowerSprites");
  if (matches.length > 1) fail(`${matches.length} manifest assets define window.TowerSprites (${matches.map((m) => m.uuid).join(", ")}) — expected exactly one`);
  return matches[0]!.TS;
}

/** Generation-time validation only (contract C1/C6) — the RLE decode itself is `paintSprite` at
 * runtime, but a bad sprite must fail here, not silently mispaint at render time. */
function validateGrid(name: string, grid: RawGrid): void {
  if (grid.h !== grid.rows.length) fail(`sprite '${name}' has ${grid.rows.length} rows, expected h=${grid.h}`);
  for (let y = 0; y < grid.rows.length; y++) {
    let width = 0;
    for (const [, count, ch] of grid.rows[y]!.matchAll(RLE)) {
      width += Number(count);
      if (ch !== "." && AL.indexOf(ch!) >= grid.pal.length) {
        fail(`sprite '${name}' row ${y} uses letter '${ch}', which has no entry in its own pal (length ${grid.pal.length})`);
      }
    }
    if (width !== grid.w) fail(`sprite '${name}' row ${y} decodes to ${width} pixels, expected w=${grid.w}`);
  }
  for (const c of grid.pal) if (!/^#[0-9a-fA-F]{6}$/.test(c)) fail(`sprite '${name}' has a non-hex pal entry '${c}'`);
}

function grid(name: string, raw: RawGrid | undefined): RawGrid {
  if (!raw) fail(`expected sprite '${name}' not found in the sheet`);
  validateGrid(name, raw!);
  return raw!;
}

function main(): void {
  const htmlPath = process.argv[2];
  if (!htmlPath) fail("usage: extract-sprites.ts <path-to-reference-sheet.html>");
  const TS = loadTowerSprites(htmlPath!);

  const PLAYER = TS.PLAYER as Record<string, Record<string, Record<string, RawGrid>>>;
  const MONSTER_SPRITES = TS.MONSTER_SPRITES as Record<string, { idle: RawGrid }>;
  const WEAPONS = TS.WEAPONS as Record<string, RawGrid>;
  const ARMOUR = TS.ARMOUR as Record<string, RawGrid>;
  const ITEMS = TS.ITEMS as Record<string, RawGrid>;
  const PROPS = TS.PROPS as Record<string, RawGrid>;
  const TILES = TS.TILES as Record<string, RawGrid>;
  const ZONE_TILES = TS.ZONE_TILES as Record<string, Record<string, RawGrid>>;

  const sprites: Record<string, RawGrid> = {};

  // Every family below is allow-listed by name (research R15) — never Object.keys() over a sheet
  // family. ITEMS is a superset of ARMOUR and TILES carries 9 out-of-scope keys on this revision;
  // an allow-list is what keeps adopted scope a property of this repo, not of the sheet.
  // 021 research R1/R2: the sheet ships genuine per-direction, multi-frame player art — `left`
  // is hand-placed, not a mirror of `right` (verified by decoding both and comparing pixels).
  // All 4 tiers x 4 directions x 4 frames are adopted so movement/animation has real art for
  // every combination, named player<Tier><Dir><Frame> (e.g. playerMailLeftStepA).
  const playerTiers = ["none", "leather", "mail", "plate"];
  const playerDirections = ["front", "right", "back", "left"];
  const playerFrames = ["idle", "stepA", "stepB", "breath"];
  let playerSpriteCount = 0;
  for (const tier of playerTiers) {
    for (const dir of playerDirections) {
      for (const frame of playerFrames) {
        const key = `player${capitalize(tier)}${capitalize(dir)}${capitalize(frame)}`;
        sprites[key] = grid(`PLAYER.${tier}.${dir}.${frame}`, PLAYER[tier]?.[dir]?.[frame]);
        playerSpriteCount++;
      }
    }
  }

  const monsterNames = ["goblin", "ogre", "wizard", "bat", "slime", "skeleton", "necromancer", "bandit", "voidwalker"];
  for (const name of monsterNames) sprites[name] = grid(`MONSTER_SPRITES.${name}.idle`, MONSTER_SPRITES[name]?.idle);

  const weaponNames = ["woodSword", "sword", "goldSword", "diamondSword"];
  for (const name of weaponNames) sprites[name] = grid(name, WEAPONS[name]);

  const armourNames = [
    "leatherHelm", "leatherChest", "leatherLegs", "leatherBoots",
    "mailHelm", "mailChest", "mailLegs", "mailBoots",
    "plateHelm", "plateChest", "plateLegs", "plateBoots",
  ];
  for (const name of armourNames) sprites[name] = grid(name, ARMOUR[name]);

  // Explicit item names only — ITEMS also carries all 12 armour keys (byte-identical to ARMOUR),
  // which a wholesale read would double-emit.
  const itemNames = ["potion", "potionAttack", "potionDefense", "keyBronze", "keySilver", "keyGold", "coin"];
  for (const name of itemNames) sprites[name] = grid(name, ITEMS[name]);

  const propNames = ["doorBronze", "doorSilver", "doorGold", "stairsUp", "stairsDown", "chest"];
  for (const name of propNames) sprites[name] = grid(name, PROPS[name]);

  // Explicit base-tile names only — TILES also carries `rubble`, `vaultDoor` and `lava1`-`lava7`,
  // all out of scope (spec Out of Scope).
  const tileNames = ["floorSlab", "floorCracked", "wallBlock", "crackedWall", "water", "spikesOff", "spikesHalf", "spikesOn", "lava"];
  for (const name of tileNames) sprites[name] = grid(name, TILES[name]);

  const expectedCount = playerSpriteCount + monsterNames.length + weaponNames.length + armourNames.length + itemNames.length + propNames.length + tileNames.length;
  if (Object.keys(sprites).length !== expectedCount) {
    fail(`allow-list mismatch: expected ${expectedCount} sprites, extracted ${Object.keys(sprites).length}`);
  }

  // Zone variants: only the 8 base tile keys that ever carry a zone variant (lava never does).
  // Sparse per zone by construction — a zone that doesn't restyle a tile simply omits it, which
  // is the normal fallback path (research R13), not an error.
  const zoneNames = ["cistern", "ruin", "forge", "crypt", "throne"];
  const zoneableTiles = tileNames.filter((n) => n !== "lava");
  const zoneTiles: Record<string, Record<string, RawGrid>> = {};
  let zoneVariantCount = 0;
  for (const zone of zoneNames) {
    const source = ZONE_TILES[zone];
    if (!source) fail(`expected zone '${zone}' not found in ZONE_TILES`);
    const variants: Record<string, RawGrid> = {};
    for (const tileName of zoneableTiles) {
      const raw = source[tileName];
      if (!raw) continue;
      variants[tileName] = grid(`ZONE_TILES.${zone}.${tileName}`, raw);
      zoneVariantCount++;
    }
    zoneTiles[zone] = variants;
  }

  // Lava's glow frame has no derivation mechanism left (research R14) — take one of the sheet's
  // own lava1-lava7 frames directly, kept outside the adopted-111 count exactly as the swap-derived
  // glow frame was kept outside the adopted-43/84/90 counts on earlier revisions.
  const lavaGlow = grid("lava2", TILES.lava2);

  const totalCount = Object.keys(sprites).length + zoneVariantCount;
  console.log(`extract-sprites: wrote ${totalCount} sprites (${Object.keys(sprites).length} + ${zoneVariantCount} zone variants) to ${OUTPUT_PATH}`);

  const banner = `/**
 * GENERATED FILE — do not hand-edit. Produced by scripts/extract-sprites.ts from the reference
 * sprite sheet ("The Tower - Sprite Sheet (9).html", section 10 "THE SHEET"). Regenerate with:
 *   npx tsx scripts/extract-sprites.ts "<path to reference sheet.html>"
 */
`;

  const body = `
export interface SpriteGrid {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  readonly rows: readonly string[];
}

export type SheetZone = "stone" | "cistern" | "ruin" | "forge" | "crypt" | "throne";

export type ArmourTierId = "none" | "leather" | "mail" | "plate";

/** 021: the sheet's four player-sprite facings — \`left\` is genuine hand-placed art, not a
 * mirror of \`right\` (research R1). */
export type PlayerDirection = "front" | "right" | "back" | "left";

export const SPRITES: Readonly<Record<string, SpriteGrid>> = ${JSON.stringify(sprites, null, 2)};

/** Pre-baked per-zone tile variants (research R13). \`stone\` carries none — it *is* the base
 * \`SPRITES\` set, not an identity variant. Resolution mirrors the sheet's own \`tile(key, zone)\`:
 * \`ZONE_TILES[zone]?.[tileKey] ?? SPRITES[tileKey]\`. */
export const ZONE_TILES: Readonly<Record<Exclude<SheetZone, "stone">, Readonly<Record<string, SpriteGrid>>>> = ${JSON.stringify(zoneTiles, null, 2)};

/** Not an adopted sprite (research R14) — one of the sheet's own lava frames, bound to the
 * existing two-state flicker timing in trapAnimation.ts. */
export const LAVA_GLOW_FRAME: SpriteGrid = ${JSON.stringify(lavaGlow, null, 2)};
`;

  writeFileSync(OUTPUT_PATH, banner + body, "utf8");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main();
