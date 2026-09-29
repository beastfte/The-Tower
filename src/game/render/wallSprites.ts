import Phaser from "phaser";
import type { ZoneThemeId } from "../../domain/floor/types";
import { paintSprite } from "./painters";
import { SPRITES } from "./spriteData";
import { paintPixelsToTexture, zoneTileGrid } from "./spriteTextures";

/**
 * Wall and door textures, sourced from the reference sprite sheet ("The Tower - Sprite Sheet
 * (9).html", section 10 "THE SHEET") via the generated `spriteData.ts` and the shared painter —
 * the same data and paint path every other sprite in the game uses. Walls resolve through the
 * same pre-baked zone-tile lookup as floors; doors have no zone variation, one sprite per tier.
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
    const tileKey = cracked ? "crackedWall" : "wallBlock";
    paintPixelsToTexture(scene, key, paintSprite(zoneTileGrid(tileKey, zone)));
  }
  return key;
}

/** Returns (creating on first use) the texture key for a closed door of the given tier. */
export function ensureDoorTexture(scene: Phaser.Scene, tier: DoorTier): string {
  const key = `door-sprite-${tier}`;
  if (!scene.textures.exists(key)) {
    paintPixelsToTexture(scene, key, paintSprite(SPRITES[DOOR_SPRITE_KEY[tier]]!));
  }
  return key;
}
