import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";

/**
 * Real pixel-art wall/door sprites lifted from the user's reference sprite sheet ("The Tower -
 * Sprite Sheet (6).html", section 08 "ZONES" for the 6 wall themes, section 11 "DOORS" for the
 * 3 door tiers) — decoded from that page's bundled sprite-data asset. Only the palette entries
 * and shapes walls/doors actually use are kept here; the sheet also defines floors, monsters,
 * props etc. this game doesn't source from this module.
 *
 * Encoding matches the sheet's own format: each row is a run-length string ("5D1S10D" = 5px of
 * palette color D, 1px of S, 10px of D); a zone or door tier is the same base shape with a
 * handful of palette letters swapped, so the silhouette never changes — only the coloring does.
 */

const PAL: Record<string, string> = {
  K: "#0a0b10",
  S: "#2f3a5c",
  M: "#4a5c8a",
  L: "#7e91bd",
  B: "#57381f",
  R: "#8b5a30",
  T: "#c99a54",
  N: "#6f7b90",
  E: "#bcc6d6",
  I: "#333c4d",
  Y: "#d9aa3b",
  y: "#f7de8e",
  G: "#8a6a1e",
  D: "#1b2133",
  j: "#1c4a4a",
  J: "#2f7a6a",
  g: "#1f4a2b",
  k: "#2b4a25",
  l: "#5f9b3f",
  x: "#241f1c",
  r: "#6e1a1a",
  e: "#c23a2c",
  Z: "#b3a888",
  O: "#e6dcc0",
  b: "#2a1a12",
};

type CharGrid = (string | null)[][];

function rle(row: string, width: number): (string | null)[] {
  const out: (string | null)[] = [];
  const re = /(\d+)(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(row))) {
    for (let i = 0; i < Number(m[1]); i++) out.push(m[2] === "." ? null : m[2]!);
  }
  while (out.length < width) out.push(null);
  return out.slice(0, width);
}

function grid(width: number, height: number, rows: string[]): CharGrid {
  const g: CharGrid = [];
  for (let y = 0; y < height; y++) g.push(rle(rows[y] ?? `${width}.`, width));
  return g;
}

function overrideRows(base: CharGrid, patch: Record<number, string>): CharGrid {
  const g = base.map((row) => row.slice());
  for (const [index, row] of Object.entries(patch)) g[Number(index)] = rle(row, base[0]!.length);
  return g;
}

function swapGrid(base: CharGrid, map: Record<string, string>): CharGrid {
  return base.map((row) => row.map((ch) => (ch !== null && map[ch] ? map[ch]! : ch)));
}

const BRICK = "1S6M1K1S6M1K";
const WALL_BLOCK = grid(16, 16, [
  "16L",
  "16M",
  BRICK,
  BRICK,
  BRICK,
  "1S6S1K1S6S1K",
  "16K",
  "16M",
  "4M1K6M1K4M",
  "4M1K6M1K4M",
  "4M1K6M1K4M",
  "4S1K6S1K4S",
  "16K",
  "16M",
  BRICK,
  BRICK,
]);

/** One continuous fissure top-right to bottom-left, widening at mid-height. */
const CRACKED_WALL = overrideRows(WALL_BLOCK, {
  2: "1S6M1K1S2M1K3M1K",
  3: "1S6M1K1S1M2K3M1K",
  4: "1S6M1K1S1M1K4M1K",
  5: "1S6S1K1S2K4S1K",
  8: "4M1K4M1K1M1K4M",
  9: "4M1K3M1K2M1K4M",
  10: "4M1K2M2K2M1K4M",
  11: "4S1K1S1K4S1K4S",
  14: "1S4M1K1M1K1S6M1K",
  15: "1S3M2K1M1K1S6M1K",
});

const E32 = "32.";
/** Door escutcheon uses placeholder letters A/C/F (metal mid/light/shadow) — never rendered
 * directly, only ever through one of the tier swaps below (which resolve them to real PAL
 * entries), matching the sheet's own doorBronze/doorSilver/doorGold. */
const DOOR_BASE = grid(32, 32, [
  E32,
  "6.20K6.",
  "5.1K20M1K5.",
  "4.1K1M20S1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K16C2K1M1K4.",
  "4.1K1M2K16F2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A10F3A2K1M1K4.",
  "4.1K1M2K3A1F2C4K2C1F3A2K1M1K4.",
  "4.1K1M2K3A1F2C1K2C1K2C1F3A2K1M1K4.",
  "4.1K1M2K3A1F2C4K2C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K3C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K3C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K1C1K1C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K3C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K1C1K1C1F3A2K1M1K4.",
  "4.1K1M2K3A1F3C2K3C1F3A2K1M1K4.",
  "4.1K1M2K3A10F3A2K1M1K4.",
  "4.1K1M2K16C2K1M1K4.",
  "4.1K1M2K16F2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M2K3A1F4A1F3A1F3A2K1M1K4.",
  "4.1K1M20S1M1K4.",
  "4.1K22S1K4.",
  "4.24K4.",
]);

/** 6 zone themes, mapped from this game's ZoneThemeId onto the sheet's own 6 named zones
 * (stone/cistern/ruin/forge/crypt/throne) by closest visual/thematic fit — cavern reads as the
 * sheet's mossy "ruin", frost as its damp cyan "cistern", ember as its soot-and-fire "forge",
 * arcane as its gold "throne" (the sheet has no purple zone). Only M/L/S are swapped because
 * wallBlock/crackedWall only use those three letters. */
const ZONE_SWAPS: Record<ZoneThemeId, Record<string, string>> = {
  stone: {},
  crypt: { M: "Z", L: "O", S: "I" },
  cavern: { M: "k", L: "l", S: "g" },
  frost: { M: "j", L: "J", S: "D" },
  ember: { M: "r", L: "e", S: "x" },
  arcane: { M: "G", L: "Y", S: "b" },
};

export type DoorTier = "bronze" | "silver" | "gold";

const DOOR_TIER_SWAPS: Record<DoorTier, Record<string, string>> = {
  bronze: { A: "R", C: "T", F: "B" },
  silver: { A: "N", C: "E", F: "I" },
  gold: { A: "Y", C: "y", F: "G" },
};

function paintTexture(scene: Phaser.Scene, key: string, chars: CharGrid): void {
  const height = chars.length;
  const width = chars[0]!.length;
  const canvasTexture = scene.textures.createCanvas(key, width, height)!;
  const ctx = canvasTexture.getContext();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = chars[y]![x];
      if (ch == null) continue;
      ctx.fillStyle = PAL[ch] ?? "#ff00ff";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvasTexture.refresh();
  canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Returns (creating on first use) the texture key for a wall tile of the given zone/type. */
export function ensureWallTexture(scene: Phaser.Scene, zone: ZoneThemeId, cracked: boolean): string {
  const key = `wall-sprite-${zone}-${cracked ? "cracked" : "normal"}`;
  if (!scene.textures.exists(key)) {
    paintTexture(scene, key, swapGrid(cracked ? CRACKED_WALL : WALL_BLOCK, ZONE_SWAPS[zone]));
  }
  return key;
}

/** Returns (creating on first use) the texture key for a closed door of the given tier. */
export function ensureDoorTexture(scene: Phaser.Scene, tier: DoorTier): string {
  const key = `door-sprite-${tier}`;
  if (!scene.textures.exists(key)) {
    paintTexture(scene, key, swapGrid(DOOR_BASE, DOOR_TIER_SWAPS[tier]));
  }
  return key;
}
