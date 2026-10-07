import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";
import type { MonsterCombatFrame } from "../monsterAnimation";
import type { WeaponId } from "../../domain/character/types";
import type { PlayerAttackFrame, PlayerFrame } from "../playerAnimation";
import { composeSprites, paintPixelsTo, paintSprite, type PixelGrid } from "./painters";
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

/** One pre-composed body per (tier, facing, frame) — armour is baked into the body, so there is
 * no recolour step (018 contract C3). 021: the key carries facing and animation frame.
 * 031 (contract C2): the equipped weapon is the one overlay — `held<Weapon><Facing><Frame>`
 * painted over the body (the sheet's own drawChar order) and baked into the same texture;
 * `weapon: null` is the bare-handed body alone. Attack frames exist for `right` only. */
export function ensurePlayerTexture(
  scene: Phaser.Scene,
  tier: ArmourTierId,
  weapon: WeaponId | null,
  facing: PlayerDirection,
  frame: PlayerFrame | PlayerAttackFrame,
): string {
  const key = `sprite-player-${tier}-${weapon ?? "bare"}-${facing}-${frame}`;
  if (!scene.textures.exists(key)) {
    const suffix = `${capitalize(facing)}${capitalize(frame)}`;
    const body = requireGrid(`player${capitalize(tier)}${suffix}`);
    const sword = weapon ? requireGrid(`held${capitalize(weapon)}${suffix}`) : null;
    paintPixelsToTexture(scene, key, composeSprites(body, sword));
  }
  return key;
}

/** 030: whether a species has side-profile combat art. Without it, combat shows the front sprite
 * and keeps the pre-030 flash-only hit feedback (FR-009). */
export function hasMonsterCombatFrames(speciesTextureKey: string): boolean {
  return SPRITES[`${speciesTextureKey}LeftIdle`] !== undefined;
}

/** 030 (contract C3): a combat monster's side-profile frame, `<species>Left<Frame>` as
 * `extract-sprites.ts` names it. A species with no side profile in `SPRITES` falls back to its
 * front sprite for every frame, so a future monster renders as combat did before 030 instead of
 * throwing (FR-009). The 44-wide attack frames are painted at their own width — positioning them
 * is the caller's job (CombatOverlay anchors the monster on its right edge, research R7). */
export function ensureMonsterCombatTexture(scene: Phaser.Scene, speciesTextureKey: string, frame: MonsterCombatFrame): string {
  if (!hasMonsterCombatFrames(speciesTextureKey)) return ensureSpriteTexture(scene, speciesTextureKey);
  return ensureSpriteTexture(scene, `${speciesTextureKey}Left${capitalize(frame)}`);
}

/** Not a sheet sprite the way the rest of the inventory is — one of the sheet's own `lava1`-
 * `lava7` frames, bound to the existing two-frame flicker timing in trapAnimation.ts (research
 * R14; the swap-derived version this replaced no longer has a mechanism to run on). */
export function ensureLavaGlowTexture(scene: Phaser.Scene): string {
  const key = "sprite-lava-glow";
  if (!scene.textures.exists(key)) paintPixelsToTexture(scene, key, paintSprite(LAVA_GLOW_FRAME));
  return key;
}
