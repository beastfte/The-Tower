import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, isSceneActive, pressAndWait } from "./helpers";

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

  await pressAndWait(page, "ArrowRight"); // -> (1,7)
  await pressAndWait(page, "ArrowRight"); // -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,7)
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

  // 022 US2 (contract C7): combat no longer closes itself — it always waits for a key press.
  // If the outcome isn't shown yet, the first press only reveals it (contract C6); press again.
  await page.keyboard.press("Enter");
  if (!(await isSceneActive(page, "FloorScene"))) {
    await page.keyboard.press("Enter");
  }
  await waitForActiveScene(page, "FloorScene", 10_000);
});

/** 022 US2 (contracts C6/C7): a key press mid-reveal shows every remaining turn and the outcome
 * at once but does not close the encounter; a further key press is still required to close it. */
test("pressing any key mid-reveal shows the outcome instantly without closing; a second press closes it", async ({
  page,
}) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // -> (1,7)
  await pressAndWait(page, "ArrowRight"); // -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,7)
  await waitForActiveScene(page, "CombatOverlay");

  // Skip immediately — before pacing could plausibly finish a multi-turn fight on its own.
  await page.keyboard.press("Enter");

  // Contract C6: the outcome is shown at once, but the encounter does not close itself.
  await expect(page.getByText(/Victory!|Defeat\.\.\./)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await isSceneActive(page, "CombatOverlay")).toBe(true);
  expect(await isSceneActive(page, "FloorScene")).toBe(false);

  // Contract C7: a further key press closes it.
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
});
