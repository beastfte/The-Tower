import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";
import { paintClassic, paintHighBit } from "./painters";
import { SPRITES, ZONE_SWAPS } from "./spriteData";
import { paintPixelsToTexture, sheetZoneFor } from "./spriteTextures";

/**
 * Wall and door textures, sourced from the reference sprite sheet ("The Tower - Sprite Sheet
 * (7).html", section 10 "THE SHEET") via the generated `spriteData.ts` and the shared painters —
 * the same data and paint path every other sprite in the game now uses. Walls/floors stay on the
 * classic painter with a zone palette swap; doors moved to the sheet's high-bit encoding, where
 * each tier is already its own distinct sprite (no swap needed) — see research R5.
 */

export type DoorTier = "bronze" | "silver" | "gold";

const DOOR_SPRITE_KEY: Record<DoorTier, string> = {
  bronze: "doorBronze",
  silver: "doorSilver",
  gold: "doorGold",
};

/** Returns (creating on first use) the texture key for a wall tile of the given zone/type. */
export function ensureWallTexture(scene: Phaser.Scene, zone: ZoneThemeId, cracked: boolean): string {
  const key = `wall-sprite-${zone}-${cracked ? "cracked" : "normal"}`;
  if (!scene.textures.exists(key)) {
    const grid = SPRITES[cracked ? "crackedWall" : "wallBlock"]!;
    paintPixelsToTexture(scene, key, paintClassic(grid, ZONE_SWAPS[sheetZoneFor(zone)]));
  }
  return key;
}

/** Returns (creating on first use) the texture key for a closed door of the given tier. */
export function ensureDoorTexture(scene: Phaser.Scene, tier: DoorTier): string {
  const key = `door-sprite-${tier}`;
  if (!scene.textures.exists(key)) {
    paintPixelsToTexture(scene, key, paintHighBit(SPRITES[DOOR_SPRITE_KEY[tier]]!));
  }
  return key;
}
