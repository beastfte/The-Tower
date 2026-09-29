import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";
import type { PlayerFrame } from "../playerAnimation";
import { paintPixelsTo, paintSprite, type PixelGrid } from "./painters";
import {
  LAVA_GLOW_FRAME,
  SPRITES,
  ZONE_TILES,
  type ArmourTierId,
  type PlayerDirection,
  type SheetZone,
  type SpriteGrid,
} from "./spriteData";

/** Maps this game's zone themes onto the sheet's own 6 named zones by closest visual/thematic
 * fit (research R5 / data-model.md), same mapping wallSprites.ts already used for walls. */
const GAME_ZONE_TO_SHEET: Record<ZoneThemeId, SheetZone> = {
  stone: "stone",
  crypt: "crypt",
  cavern: "ruin",
  frost: "cistern",
  ember: "forge",
  arcane: "throne",
};

export function sheetZoneFor(zone: ZoneThemeId): SheetZone {
  return GAME_ZONE_TO_SHEET[zone];
}

/** Mirrors the sheet's own `tile(key, zone)`: a zone's pre-baked variant, falling back to the
 * base tile when that zone doesn't restyle it (contract C5). `stone` always falls through, since
 * it carries no variants of its own. */
export function zoneTileGrid(tileKey: string, zone: ZoneThemeId): SpriteGrid {
  const sheetZone = sheetZoneFor(zone);
  const variant = sheetZone === "stone" ? undefined : ZONE_TILES[sheetZone]?.[tileKey];
  return variant ?? requireGrid(tileKey);
}

function requireGrid(spriteKey: string): SpriteGrid {
  const grid = SPRITES[spriteKey];
  if (!grid) throw new Error(`Unknown sprite key: ${spriteKey}`);
  return grid;
}

export function paintPixelsToTexture(scene: Phaser.Scene, key: string, pixels: PixelGrid): string {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const canvasTexture = scene.textures.createCanvas(key, width, height)!;
  paintPixelsTo(canvasTexture.getContext(), pixels);
  canvasTexture.refresh();
  canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** For DOM-rendered icons outside Phaser's own canvas (SidePanelScene) — the same sprite data,
 * painted onto a plain `<canvas>` and read back as a data URL an `<img src>` can use directly. */
export function spriteDataUrl(spriteKey: string): string {
  const grid = requireGrid(spriteKey);
  const canvas = document.createElement("canvas");
  canvas.width = grid.w;
  canvas.height = grid.h;
  paintPixelsTo(canvas.getContext("2d")!, paintSprite(grid));
  return canvas.toDataURL();
}

/** Idempotent, lazy: creates the texture on first request, returns the same key thereafter
 * (contract C2). The sprite key doubles as the Phaser texture key — this also lets a texture
 * loaded by some other means (the lever's kept SVG art, FR-025 — not in `SPRITES`) pass through
 * untouched: if it already exists, this is a no-op. */
export function ensureSpriteTexture(scene: Phaser.Scene, spriteKey: string): string {
  if (!scene.textures.exists(spriteKey)) paintPixelsToTexture(scene, spriteKey, paintSprite(requireGrid(spriteKey)));
  return spriteKey;
}

export function ensureZoneTileTexture(scene: Phaser.Scene, tileKey: string, zone: ZoneThemeId): string {
  const key = `sprite-${tileKey}-${zone}`;
  if (!scene.textures.exists(key)) paintPixelsToTexture(scene, key, paintSprite(zoneTileGrid(tileKey, zone)));
  return key;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Direct lookup — the sheet ships one pre-composed body per (tier, facing, frame), so there is
 * no overlay and no recolour step (contract C3). `tier: "none"` is a sprite like any other.
 * 021: extended from a tier-only key to also carry facing and animation frame (contract C6) —
 * the sprite-data key is derived at call time (`player<Tier><Facing><Frame>`), mirroring exactly
 * how `extract-sprites.ts` names the 64 grids it generates. */
export function ensurePlayerTexture(
  scene: Phaser.Scene,
  tier: ArmourTierId,
  facing: PlayerDirection,
  frame: PlayerFrame,
): string {
  const key = `sprite-player-${tier}-${facing}-${frame}`;
  if (!scene.textures.exists(key)) {
    const spriteKey = `player${capitalize(tier)}${capitalize(facing)}${capitalize(frame)}`;
    paintPixelsToTexture(scene, key, paintSprite(requireGrid(spriteKey)));
  }
  return key;
}

/** Not a sheet sprite the way the rest of the inventory is — one of the sheet's own `lava1`-
 * `lava7` frames, bound to the existing two-frame flicker timing in trapAnimation.ts (research
 * R14; the swap-derived version this replaced no longer has a mechanism to run on). */
export function ensureLavaGlowTexture(scene: Phaser.Scene): string {
  const key = "sprite-lava-glow";
  if (!scene.textures.exists(key)) paintPixelsToTexture(scene, key, paintSprite(LAVA_GLOW_FRAME));
  return key;
}
