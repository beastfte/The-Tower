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
  /** 030: Sheet (10)'s horizontal draw offset in sprite pixels (the sheet's `paint` does
   * `ox += dx * px`). Non-zero only on the 44-wide monster attack frames (-12). */
  dx?: number;
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
  // Sheet (10) stamps `dx: 0` on every grid; carry it only where it means something, so the
  // generated data stays unchanged for every sprite that doesn't shift.
  const { w, h, pal, rows, dx } = raw!;
  return dx ? { w, h, pal, rows, dx } : { w, h, pal, rows };
}


const ARMOUR_SLOTS = ["helm", "chest", "legs", "boots"] as const;
type ArmourSlot = (typeof ARMOUR_SLOTS)[number];
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function decodeGrid(g: RawGrid): (string | null)[][] {
  return g.rows.map((row) => {
    const out: (string | null)[] = [];
    for (const [, count, ch] of row.matchAll(RLE)) {
      for (let i = 0; i < Number(count); i++) out.push(ch === "." ? null : g.pal[ALPHABET.indexOf(ch!)]!);
    }
    return out;
  });
}

function encodeGrid(px: (string | null)[][]): RawGrid {
  const pal: string[] = [];
  const rows = px.map((row) => {
    let out = "";
    for (let x = 0; x < row.length; ) {
      let n = 1;
      while (x + n < row.length && row[x + n] === row[x]) n++;
      const c = row[x];
      if (c == null) out += `${n}.`;
      else {
        let i = pal.indexOf(c);
        if (i < 0) pal.push(c), (i = pal.length - 1);
        if (i >= ALPHABET.length) fail("armour layer palette exceeds 52 colours");
        out += `${n}${ALPHABET[i]}`;
      }
      x += n;
    }
    return out;
  });
  return { w: px[0]!.length, h: px.length, pal, rows };
}

const topRow = (px: (string | null)[][]): number => px.findIndex((r) => r.some((c) => c != null));
const firstRowOf = (px: (string | null)[][]): number => {
  const y = topRow(px);
  if (y < 0) fail("armour layer has no pixels");
  return y;
};

/** 035 research R3: one tier/direction/frame's full body split into helm/chest/legs/boots by row
 * band. Cuts are the first rows of the sheet's authored chest/legs/boots layers (front cuts serve
 * front+back, right cuts serve right+left), shifted by the frame's body bob versus idle. Verifies
 * the split is lossless: none + layers must equal the sheet's own full-tier body. */
function deriveArmourLayers(
  tier: string,
  dir: string,
  frame: string,
  PLAYER: Record<string, Record<string, Record<string, RawGrid>>>,
  LAYERS: Record<string, Record<string, Record<string, RawGrid>>>,
): Record<ArmourSlot, RawGrid> {
  const label = `${tier}.${dir}.${frame}`;
  const none = decodeGrid(grid(`PLAYER.none.${dir}.${frame}`, PLAYER.none?.[dir]?.[frame]));
  const full = decodeGrid(grid(`PLAYER.${tier}.${dir}.${frame}`, PLAYER[tier]?.[dir]?.[frame]));
  if (none.length !== full.length || none[0]!.length !== full[0]!.length) fail(`${label}: tier body size differs from the unarmoured body`);

  const authoredDir = dir === "front" || dir === "back" ? "front" : "right";
  const cut = (slot: string): number => firstRowOf(decodeGrid(grid(`ARMOUR_LAYERS.${tier}.${slot}.${authoredDir}`, LAYERS[tier]?.[slot]?.[authoredDir])));
  const idleNone = decodeGrid(grid(`PLAYER.none.${dir}.idle`, PLAYER.none?.[dir]?.idle));
  const bob = topRow(none) - topRow(idleNone);
  const chestAt = cut("chest") + bob, legsAt = cut("legs") + bob, bootsAt = cut("boots") + bob;

  const layers = Object.fromEntries(ARMOUR_SLOTS.map((s) => [s, none.map((r) => r.map(() => null as string | null))])) as Record<ArmourSlot, (string | null)[][]>;
  for (let y = 0; y < full.length; y++) {
    const slot: ArmourSlot = y >= bootsAt ? "boots" : y >= legsAt ? "legs" : y >= chestAt ? "chest" : "helm";
    for (let x = 0; x < full[y]!.length; x++) {
      const a = none[y]![x]!, b = full[y]![x]!;
      if (a != null && b == null) fail(`${label}: armour clears an unarmoured pixel at ${x},${y}`);
      if (b != null && b !== a) layers[slot][y]![x] = b;
    }
  }

  const recomposed = none.map((r) => r.slice());
  for (const slot of ARMOUR_SLOTS) layers[slot].forEach((r, y) => r.forEach((c, x) => { if (c != null) recomposed[y]![x] = c; }));
  for (let y = 0; y < full.length; y++) for (let x = 0; x < full[y]!.length; x++) {
    if (recomposed[y]![x] !== full[y]![x]) fail(`${label}: layers do not recompose to the full-tier body at ${x},${y}`);
  }
  return Object.fromEntries(ARMOUR_SLOTS.map((s) => [s, encodeGrid(layers[s])])) as Record<ArmourSlot, RawGrid>;
}

function main(): void {
  const htmlPath = process.argv[2];
  if (!htmlPath) fail("usage: extract-sprites.ts <path-to-reference-sheet.html>");
  const TS = loadTowerSprites(htmlPath!);

  const PLAYER = TS.PLAYER as Record<string, Record<string, Record<string, RawGrid>>>;
  // 031 research R2/R3: Sheet (11)'s sword-in-hand overlays, painted over the body by the sheet's
  // own drawChar — same [key][dir][frame] shape as PLAYER, keyed by WeaponId.
  const HELD_SWORD = TS.HELD_SWORD as Record<string, Record<string, Record<string, RawGrid>>>;
  const MONSTER_SPRITES = TS.MONSTER_SPRITES as Record<
    string,
    { idle: RawGrid; breath?: RawGrid; left?: { idle: RawGrid; breath: RawGrid; attackA: RawGrid; attackB: RawGrid } }
  >;
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
  const playerDirections = ["front", "right", "back", "left"];
  const playerFrames = ["idle", "stepA", "stepB", "breath"];
  const attackFrames = ["attackA", "attackB"];
  const framesFor = (dir: string) => (dir === "right" ? [...playerFrames, ...attackFrames] : playerFrames);
  // 035 (research R5): only the unarmoured body is adopted as a full sprite — worn armour is now
  // per-slot layers, composed at runtime. 031 research R4: attack frames exist for `right` only.
  let playerSpriteCount = 0;
  for (const dir of playerDirections) {
    for (const frame of framesFor(dir)) {
      sprites[`playerNone${capitalize(dir)}${capitalize(frame)}`] = grid(`PLAYER.none.${dir}.${frame}`, PLAYER.none?.[dir]?.[frame]);
      playerSpriteCount++;
    }
  }

  // 035 (contract C1, research R3): derive per-slot armour layers from the sheet's full-tier bodies,
  // because the sheet's own ARMOUR_LAYERS exist for front/right idle only.
  const ARMOUR_LAYERS = TS.ARMOUR_LAYERS as Record<string, Record<string, Record<string, RawGrid>>>;
  for (const tier of ["leather", "mail", "plate"]) {
    for (const dir of playerDirections) {
      for (const frame of framesFor(dir)) {
        const layers = deriveArmourLayers(tier, dir, frame, PLAYER, ARMOUR_LAYERS);
        for (const slot of ARMOUR_SLOTS) {
          sprites[`armour${capitalize(tier)}${capitalize(slot)}${capitalize(dir)}${capitalize(frame)}`] = layers[slot]!;
          playerSpriteCount++;
        }
      }
    }
  }

  const monsterNames = ["goblin", "ogre", "wizard", "bat", "slime", "skeleton", "necromancer", "bandit", "voidwalker"];
  for (const name of monsterNames) sprites[name] = grid(`MONSTER_SPRITES.${name}.idle`, MONSTER_SPRITES[name]?.idle);

  // 030 (contract C1): each combat monster's side profile, facing the Prince, for the combat
  // screens only — the front `.idle` above stays the floor sprite. attackA/attackB are 44x32
  // with the extra width on the left; the right 32 columns are the body (research R2).
  const monsterLeftFrames = ["idle", "breath", "attackA", "attackB"] as const;
  for (const name of monsterNames) {
    for (const frame of monsterLeftFrames) {
      sprites[`${name}Left${capitalize(frame)}`] = grid(`MONSTER_SPRITES.${name}.left.${frame}`, MONSTER_SPRITES[name]?.left?.[frame]);
    }
  }

  // 036 (contract C1): the elite variants — recoloured full grids, same geometry as the regular
  // ones. `<m>Elite` is the floor sprite, `<m>EliteLeft<Frame>` the combat frames. eliteBreath is
  // not adopted: the regular front `.breath` isn't either, so elites mirror regular monsters.
  const eliteLeftFrames = ["idle", "breath", "attackA", "attackB"] as const;
  for (const name of monsterNames) {
    sprites[`${name}Elite`] = grid(`MONSTER_SPRITES.${name}.eliteIdle`, MONSTER_SPRITES[name]?.eliteIdle);
    for (const frame of eliteLeftFrames) {
      sprites[`${name}EliteLeft${capitalize(frame)}`] = grid(`MONSTER_SPRITES.${name}.eliteLeft.${frame}`, MONSTER_SPRITES[name]?.eliteLeft?.[frame]);
    }
  }

  // 023: unlike every combat monster above (which adopts only `.idle`), the merchant adopts
  // both `.idle` and `.breath` — it needs a real 2-frame breathing animation (FR-002), and the
  // sheet itself marks it as a non-combatant by carrying no `eliteIdle`/`eliteBreath` pair.
  sprites.merchantIdle = grid("MONSTER_SPRITES.merchant.idle", MONSTER_SPRITES.merchant?.idle);
  sprites.merchantBreath = grid("MONSTER_SPRITES.merchant.breath", MONSTER_SPRITES.merchant?.breath);

  const weaponNames = ["woodSword", "sword", "diamondSword"];
  for (const name of weaponNames) sprites[name] = grid(name, WEAPONS[name]);

  // 031 (data-model.md 1.2): held swords, prefixed `held` so they cannot collide with the flat
  // 16x16 pickup icons above. Every facing/frame the body has, plus the two right-only attack frames.
  let heldSwordCount = 0;
  for (const weapon of weaponNames) {
    for (const dir of playerDirections) {
      const frames = dir === "right" ? [...playerFrames, ...attackFrames] : playerFrames;
      for (const frame of frames) {
        sprites[`held${capitalize(weapon)}${capitalize(dir)}${capitalize(frame)}`] = grid(
          `HELD_SWORD.${weapon}.${dir}.${frame}`,
          HELD_SWORD[weapon]?.[dir]?.[frame],
        );
        heldSwordCount++;
      }
    }
  }

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

  const expectedCount =
    playerSpriteCount + monsterNames.length + monsterNames.length * monsterLeftFrames.length +
    monsterNames.length * (1 + eliteLeftFrames.length) /* 036 elites */ +
    2 /* merchantIdle, merchantBreath */ +
    weaponNames.length + heldSwordCount + armourNames.length + itemNames.length + propNames.length + tileNames.length;
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
 * sprite sheet ("The Tower - Sprite Sheet (1).html", section 11 "THE SHEET"). Regenerate with:
 *   npx tsx scripts/extract-sprites.ts "<path to reference sheet.html>"
 */
`;

  const body = `
export interface SpriteGrid {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  readonly rows: readonly string[];
  /** Horizontal draw offset in sprite pixels, as the sheet's own \`paint\` applies it. Present only
   * on the 44-wide monster attack frames (-12): their right 32 columns line up with the 32-wide
   * idle grid, and the extra width reaches left (030 research R2). */
  readonly dx?: number;
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
