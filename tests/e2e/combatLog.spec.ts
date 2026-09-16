import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, pressAndWait } from "./helpers";

/**
 * 010 US3/FR-009/FR-010: the combat log is a fixed-size, natively-scrolling area (not an
 * unbounded-growth div) that auto-follows the newest turn. Reuses floorPlay.spec.ts's proven
 * move sequence to trigger floor-01's compulsory goblin fight.
 */
test("combat log has a fixed scrollable height and auto-follows the newest turn", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // -> (1,10)
  await pressAndWait(page, "ArrowRight"); // -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,10)
  await waitForActiveScene(page, "CombatOverlay");

  const log = page.locator('[data-testid="combat-log"]');
  await expect(log).toBeVisible();

  const style = await log.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { height: parseFloat(cs.height), overflowY: cs.overflowY };
  });
  expect(style.height).toBeGreaterThan(0);
  expect(["auto", "scroll"]).toContain(style.overflowY);

  await expect(log).not.toHaveText("", { timeout: 5000 });
  const scrollState = await log.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollState.scrollTop).toBeGreaterThanOrEqual(scrollState.scrollHeight - scrollState.clientHeight - 1);

  await waitForActiveScene(page, "FloorScene", 10_000);
});
