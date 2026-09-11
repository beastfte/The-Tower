import { test, expect } from "@playwright/test";

// Deliberately not imported from src/game/gameConfig.ts: that module (and anything else under
// src/game/) pulls in the `phaser` package, which assumes browser globals at module-load time
// and crashes when evaluated in Playwright's Node-side test runner. Keep these in sync with
// GAME_WIDTH/GAME_HEIGHT (360/280 design size * RENDER_SCALE) and the scale.max multiplier
// in src/game/gameConfig.ts / scaleConfig.ts.
const GAME_WIDTH = 360 * 1.5;
const GAME_HEIGHT = 280 * 1.5;

/**
 * 002 US6 / FR-021-023 (T035): the game must be comfortably readable at default browser
 * zoom, scale with the window within sensible bounds, and stay crisp at any resulting size.
 */
test.describe("Display scaling and crispness", () => {
  test("renders noticeably larger than the native resolution at a typical desktop window (FR-021)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page).toHaveTitle("The Tower");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(GAME_WIDTH * 1.5);
    expect(box!.height).toBeGreaterThan(GAME_HEIGHT * 1.5);
  });

  test("grows when the window grows, bounded by the configured maximum (FR-022)", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/");
    const smallBox = await page.locator("canvas").boundingBox();

    await page.setViewportSize({ width: 2400, height: 1400 });
    await page.waitForTimeout(300);
    const largeBox = await page.locator("canvas").boundingBox();

    expect(largeBox!.width).toBeGreaterThan(smallBox!.width);
    expect(largeBox!.height).toBeGreaterThan(smallBox!.height);
    expect(largeBox!.width).toBeLessThanOrEqual(GAME_WIDTH * 4 + 1);
    expect(largeBox!.height).toBeLessThanOrEqual(GAME_HEIGHT * 4 + 1);
  });

  test("shrinks when the window shrinks, bounded by the configured minimum (FR-022)", async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 1200 });
    await page.goto("/");
    const largeBox = await page.locator("canvas").boundingBox();

    await page.setViewportSize({ width: 500, height: 400 });
    await page.waitForTimeout(300);
    const smallBox = await page.locator("canvas").boundingBox();

    expect(smallBox!.width).toBeLessThan(largeBox!.width);
    expect(smallBox!.width).toBeGreaterThanOrEqual(GAME_WIDTH - 1);
    expect(smallBox!.height).toBeGreaterThanOrEqual(GAME_HEIGHT - 1);
  });

  test("canvas stays pixelated (crisp, non-blurred) regardless of size (FR-023)", async ({ page }) => {
    await page.goto("/");
    const rendering = await page
      .locator("canvas")
      .evaluate((el) => window.getComputedStyle(el).imageRendering);
    expect(rendering).toBe("pixelated");

    await page.setViewportSize({ width: 2200, height: 1300 });
    await page.waitForTimeout(300);
    const renderingAtLargeSize = await page
      .locator("canvas")
      .evaluate((el) => window.getComputedStyle(el).imageRendering);
    expect(renderingAtLargeSize).toBe("pixelated");
  });
});
