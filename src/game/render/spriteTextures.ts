import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";
import { paintArmourOverlay, paintClassic, paintHighBit, paintPixelsTo, type PixelGrid } from "./painters";
import { ARMOUR_TIERS, LAVA_GLOW_SWAP, SPRITES, ZONE_SWAPS, type ArmourTierId, type SheetZone } from "./spriteData";

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

export function paintPixelsToTexture(scene: Phaser.Scene, key: string, pixels: PixelGrid): string {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const canvasTexture = scene.textures.createCanvas(key, width, height)!;
  paintPixelsTo(canvasTexture.getContext(), pixels);
  canvasTexture.refresh();
  canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

function paintGrid(spriteKey: string, swap?: Record<string, string>): PixelGrid {
  const grid = SPRITES[spriteKey];
  if (!grid) throw new Error(`Unknown sprite key: ${spriteKey}`);
  return grid.hb ? paintHighBit(grid) : paintClassic(grid, swap);
}

/** For DOM-rendered icons outside Phaser's own canvas (SidePanelScene) — the same sprite data,
 * painted onto a plain `<canvas>` and read back as a data URL an `<img src>` can use directly. */
export function spriteDataUrl(spriteKey: string): string {
  const grid = SPRITES[spriteKey];
  if (!grid) throw new Error(`Unknown sprite key: ${spriteKey}`);
  const canvas = document.createElement("canvas");
  canvas.width = grid.w;
  canvas.height = grid.h;
  paintPixelsTo(canvas.getContext("2d")!, paintGrid(spriteKey));
  return canvas.toDataURL();
}

/** Idempotent, lazy: creates the texture on first request, returns the same key thereafter
 * (contract C2). The sprite key doubles as the Phaser texture key — this also lets a texture
 * loaded by some other means (the lever's kept SVG art, FR-025 — not in `SPRITES`) pass through
 * untouched: if it already exists, this is a no-op. */
export function ensureSpriteTexture(scene: Phaser.Scene, spriteKey: string): string {
  if (!scene.textures.exists(spriteKey)) paintPixelsToTexture(scene, spriteKey, paintGrid(spriteKey));
  return spriteKey;
}

export function ensureZoneTileTexture(scene: Phaser.Scene, tileKey: string, zone: ZoneThemeId): string {
  const key = `sprite-${tileKey}-${zone}`;
  if (!scene.textures.exists(key)) {
    paintPixelsToTexture(scene, key, paintGrid(tileKey, ZONE_SWAPS[sheetZoneFor(zone)]));
  }
  return key;
}

/** Composes base player + tier-recoloured armour overlay into one image (contract C3). Tier
 * "none" draws the base only — the overlay is skipped, not drawn transparent. */
export function ensurePlayerTexture(scene: Phaser.Scene, tier: ArmourTierId): string {
  const key = `sprite-player-${tier}`;
  if (!scene.textures.exists(key)) {
    const base = SPRITES.player!;
    const pixels = paintClassic(base);
    if (tier !== "none") {
      const overlay = paintArmourOverlay(SPRITES.playerArmour!, tier, ARMOUR_TIERS);
      for (let y = 0; y < overlay.length; y++) {
        for (let x = 0; x < overlay[y]!.length; x++) {
          const c = overlay[y]![x];
          if (c != null) pixels[y]![x] = c;
        }
      }
    }
    paintPixelsToTexture(scene, key, pixels);
  }
  return key;
}

/** Not a sheet sprite — see research R9. Promotes `lava`'s own ramp one step via the classic
 * painter's swap mechanism, reused outside the zone context (contract C5). */
export function ensureLavaGlowTexture(scene: Phaser.Scene): string {
  const key = "sprite-lava-glow";
  if (!scene.textures.exists(key)) paintPixelsToTexture(scene, key, paintClassic(SPRITES.lava!, LAVA_GLOW_SWAP));
  return key;
}
