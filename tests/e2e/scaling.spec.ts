import { test, expect } from "@playwright/test";
import { clearSave, startFight } from "./helpers";

// Deliberately not imported from src/game/gameConfig.ts: that module (and anything else under
// src/game/) pulls in the `phaser` package, which assumes browser globals at module-load time
// and crashes when evaluated in Playwright's Node-side test runner. Keep these in sync with
// GAME_WIDTH/GAME_HEIGHT (922/846 design size * RENDER_SCALE — 014 grew the design size to fit
// the fixed 15x15/64px floor baseline) and the scale.max multiplier in
// src/game/gameConfig.ts / scaleConfig.ts.
const GAME_WIDTH = 922 * 1.5;
const GAME_HEIGHT = 846 * 1.5;

// 014 FR-011: Scale.FIT has no minimum at all — a fixed floor (first the native resolution,
// then the smaller design resolution) forced the canvas to overflow the page (a page-level
// scroll bar) whenever the real viewport was shorter than that floor, which real desktop
// browsers at 100% zoom routinely are once the native resolution grew to fit the fixed
// 15x15/64px floor baseline. RENDER_SCALE's whole purpose is to give the backing store more
// detail for exactly this kind of shrink, not to raise a floor beneath it.
const DESIGN_WIDTH = 922;
const DESIGN_HEIGHT = 846;

/**
 * 002 US6 / FR-021-023 (T035): the game must be comfortably readable at default browser
 * zoom, scale with the window within sensible bounds, and stay crisp at any resulting size.
 */
test.describe("Display scaling and crispness", () => {
  test("renders noticeably larger than the native resolution at a typical desktop window (FR-021)", async ({
    page,
  }) => {
    // 014: native resolution grew to 1104x1056 (from 540x420) to fit the fixed 15x15/64px
    // floor baseline — a 1280x800 window (this test's viewport pre-014) can no longer render
    // it "noticeably larger" at all (it barely fits), so a bigger, still-ordinary desktop
    // viewport and a more modest "noticeably larger" margin are used instead.
    // 033: the board is now 1383x1269 native (the tower plus the panel and log cards), so a
    // 1920x1200 window no longer renders it noticeably larger — an even bigger viewport is used.
    await page.setViewportSize({ width: 2400, height: 1500 });
    await page.goto("/");
    await expect(page).toHaveTitle("The Tower");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(GAME_WIDTH * 1.05);
    expect(box!.height).toBeGreaterThan(GAME_HEIGHT * 1.05);
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

  test("shrinks when the window shrinks, with no fixed minimum floor (014 FR-011)", async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 1200 });
    await page.goto("/");
    const largeBox = await page.locator("canvas").boundingBox();

    await page.setViewportSize({ width: 500, height: 400 });
    await page.waitForTimeout(300);
    const smallBox = await page.locator("canvas").boundingBox();

    expect(smallBox!.width).toBeLessThan(largeBox!.width);
    // No minimum bound: at a viewport smaller than the design resolution, the canvas shrinks
    // past it too (not clamped to 922x846) — the exact opposite of the old behavior this test
    // used to assert, and the whole point of FR-011 (no page-level scroll bar at any viewport).
    expect(smallBox!.width).toBeLessThan(DESIGN_WIDTH);
    expect(smallBox!.height).toBeLessThan(DESIGN_HEIGHT);
    // And it still fits fully inside the viewport that was given to it.
    expect(smallBox!.width).toBeLessThanOrEqual(500);
    expect(smallBox!.height).toBeLessThanOrEqual(400);
  });

  test("never produces a page-level scroll bar, even at a viewport shorter than the design height (014 SC-007)", async ({
    page,
  }) => {
    // A typical desktop width but shorter than DESIGN_HEIGHT (846) — representative of a
    // maximized browser window whose visible viewport is reduced by tabs/address bar/etc.
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();

    const hasScrollbar = await page.evaluate(() => {
      return (
        document.documentElement.scrollHeight > window.innerHeight ||
        document.documentElement.scrollWidth > window.innerWidth
      );
    });
    expect(hasScrollbar).toBe(false);
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

/** 027 SC-012 (contract C9): the combat modal stays entirely inside the play area at every
 * window size, with nothing overlapping. The play area is the 640×640 design-unit tower card at (12, 12)
 * (side panel card to the right, event log card below). */
test("the combat modal fits inside the play area at every window size, nothing overlapping (027 SC-012)", async ({
  page,
}) => {
  await clearSave(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  // A fight that can't end on its own while we measure.
  await startFight(page, { character: { baseStats: { damage: 0, defence: 100_000, hp: 30 }, currentHp: 30, bonusDamage: 0 } });

  const ids = ["combat-player-hp", "combat-monster-hp", "combat-player-bar", "combat-monster-bar", "combat-potion", "combat-flee"];
  for (const size of [
    { width: 800, height: 600 },
    { width: 1280, height: 900 },
    { width: 1920, height: 1200 },
    { width: 2400, height: 1400 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const canvas = (await page.locator("canvas").boundingBox())!;
    const play = {
      x: canvas.x + (12 / DESIGN_WIDTH) * canvas.width,
      y: canvas.y + (12 / DESIGN_HEIGHT) * canvas.height,
      right: canvas.x + (652 / DESIGN_WIDTH) * canvas.width,
      bottom: canvas.y + (652 / DESIGN_HEIGHT) * canvas.height,
    };
    const modal = (await page.locator('[data-testid="combat-modal"]').boundingBox())!;
    const slack = 1; // sub-pixel rounding
    expect(modal.x, `${size.width}x${size.height} left`).toBeGreaterThanOrEqual(play.x - slack);
    expect(modal.y, `${size.width}x${size.height} top`).toBeGreaterThanOrEqual(play.y - slack);
    expect(modal.x + modal.width, `${size.width}x${size.height} right`).toBeLessThanOrEqual(play.right + slack);
    expect(modal.y + modal.height, `${size.width}x${size.height} bottom`).toBeLessThanOrEqual(play.bottom + slack);

    const boxes = [];
    for (const id of ids) {
      const box = (await page.locator(`[data-testid="${id}"]`).boundingBox())!;
      expect(box.width, `${id} visible at ${size.width}x${size.height}`).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(modal.x - slack);
      expect(box.x + box.width).toBeLessThanOrEqual(modal.x + modal.width + slack);
      expect(box.y).toBeGreaterThanOrEqual(modal.y - slack);
      expect(box.y + box.height).toBeLessThanOrEqual(modal.y + modal.height + slack);
      boxes.push({ id, ...box });
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${a.id} overlaps ${b.id} at ${size.width}x${size.height}`).toBe(false);
      }
    }
  }
});
