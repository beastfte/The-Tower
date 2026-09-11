import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene } from "./helpers";

// Mirrors gameConfig.ts at the current RENDER_SCALE (1.5), kept local since importing
// gameConfig.ts (or anything under src/game/) pulls in the `phaser` package, which crashes
// when evaluated in Playwright's Node-side test runner.
const GAME_WIDTH = 540;
const GAME_HEIGHT = 420;
const SIDE_PANEL_WIDTH = 144;
const EVENT_LOG_HEIGHT = 96;
const PLAY_AREA = {
  x: 0,
  y: 0,
  width: GAME_WIDTH - SIDE_PANEL_WIDTH,
  height: GAME_HEIGHT - EVENT_LOG_HEIGHT,
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
