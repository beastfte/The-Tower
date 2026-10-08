import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene } from "./helpers";

// Mirrors gameConfig.ts at the current RENDER_SCALE (1.5), kept local since importing
// gameConfig.ts (or anything under src/game/) pulls in the `phaser` package, which crashes
// when evaluated in Playwright's Node-side test runner. 014 resized the floor/tile baseline
// to a fixed 15x15 grid of 64px tiles, growing GAME_WIDTH/GAME_HEIGHT accordingly (via
// scaleConfig.ts's DESIGN_WIDTH/DESIGN_HEIGHT) so PLAY_AREA now evaluates to exactly 960x960.
const GUTTER = 18;
const TILE_SIZE = 64;
const PLAY_AREA = {
  x: GUTTER,
  y: GUTTER,
  width: 960,
  height: 960,
};

/** Regression guard for the play-area-tile-overflow bug fix: the floor grid must always
 * fit entirely within PLAY_AREA, never rendering behind the side panel or event log. */
test("every rendered floor tile, marker, and the player stay within PLAY_AREA bounds", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const outOfBounds = await page.evaluate((area) => {
    const win = window as unknown as {
      __game: { scene: { getScene: (k: string) => { children: { list: { type: string; list?: unknown[] } [] } } } };
    };
    const scene = win.__game.scene.getScene("FloorScene");
    const container = scene.children.list.find((c) => c.type === "Container");
    const children = (container?.list ?? []) as {
      getBounds: () => { left: number; right: number; top: number; bottom: number };
    }[];

    const EPSILON = 0.5; // sub-pixel rounding slack
    return children
      .map((child) => child.getBounds())
      .filter(
        (b) =>
          b.left < area.x - EPSILON ||
          b.top < area.y - EPSILON ||
          b.right > area.x + area.width + EPSILON ||
          b.bottom > area.y + area.height + EPSILON,
      );
  }, PLAY_AREA);

  expect(outOfBounds).toEqual([]);
});

/** 014 SC-002: every floor tile renders at a fixed 64x64px, not a size computed to fit the
 * grid into PLAY_AREA. Wall tiles (`addWallTile`) and door markers (`addDoorMarker`) both call
 * `image.setDisplaySize(size, size)` with no further scale multiplier, so their rendered
 * bounds are the clearest direct read of the actual tile size in use. */
test("a rendered wall tile measures exactly 64x64 pixels", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const wallTileSize = await page.evaluate(() => {
    const win = window as unknown as {
      __game: { scene: { getScene: (k: string) => { children: { list: { type: string; list?: unknown[] } [] } } } };
    };
    const scene = win.__game.scene.getScene("FloorScene");
    const container = scene.children.list.find((c) => c.type === "Container");
    const children = (container?.list ?? []) as {
      type: string;
      getBounds: () => { width: number; height: number };
    }[];

    // Only a full-tile image (wall/door — no scale multiplier applied) renders at exactly
    // TILE_SIZE square; every other Image (stairs, water, lever, item/enemy markers, the
    // player) is deliberately drawn smaller via a scale multiplier (see FloorScene.ts), so
    // this filter can't accidentally match one of those instead.
    const tileImage = children.find((c) => {
      if (c.type !== "Image") return false;
      const b = c.getBounds();
      return Math.abs(b.width - 64) < 1 && Math.abs(b.height - 64) < 1;
    });
    return tileImage?.getBounds();
  });

  expect(wallTileSize).toBeDefined();
  expect(wallTileSize!.width).toBeCloseTo(TILE_SIZE, 0);
  expect(wallTileSize!.height).toBeCloseTo(TILE_SIZE, 0);
});
