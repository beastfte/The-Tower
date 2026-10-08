import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import type { PlayerSave } from "../../src/domain/character/save";
import { seedSave, waitForActiveScene, startScene } from "./helpers";

const firstFloor = TOWER.floors[0]!;

function freshSave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return { ...createInitialPlayerSave(firstFloor.id, firstFloor.entrance), ...overrides };
}

/** Regression coverage for the 3 gaps /speckit-converge found (tasks.md T040-T042). */
test.describe("Convergence fixes", () => {
  test("T040: the bag grid scrolls once a save holds more entries than fit (033 FR-016c)", async ({ page }) => {
    await seedSave(page, freshSave());
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    // Force overflow: far more distinct loot entries than the 25-slot grid shows at once. An old
    // save can hold more than the limit; nothing is removed and the grid scrolls instead.
    await page.evaluate(() => {
      const win = window as unknown as {
        __game: { registry: { get: (k: string) => { save: PlayerSave } } };
      };
      const ctx = win.__game.registry.get("ctx");
      for (let i = 0; i < 60; i++) ctx.save.character.inventory.push(`synthetic-loot-${i}`);
    });
    await page.waitForTimeout(200); // let SidePanelScene's update() notice the signature change

    const grid = page.locator('[data-testid="bag-grid"]');
    const gridScrollTop = () => grid.evaluate((el) => el.scrollTop);
    expect(await gridScrollTop()).toBe(0); // not scrolled yet
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("60 / 25 · Full");

    await grid.hover();
    await page.mouse.wheel(0, 400); // scroll down (toward later items)
    await page.waitForTimeout(100);

    expect(await gridScrollTop()).toBeGreaterThan(0);
  });

  test("T041: the event log follows the newest entry but holds still while scrolled back (033 FR-012)", async ({
    page,
  }) => {
    await seedSave(page, freshSave());
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    const push = (from: number, to: number) =>
      page.evaluate(
        ([a, b]) => {
          const win = window as unknown as {
            __game: { registry: { get: (k: string) => { eventLog: { kind: string; message: string }[] } } };
          };
          const log = win.__game.registry.get("ctx").eventLog;
          for (let i = a!; i < b!; i++) log.push({ kind: "pickup", message: `Synthetic event ${i}` });
        },
        [from, to],
      );
    await push(0, 40);
    await page.waitForTimeout(200);

    const list = page.locator('[data-testid="event-log-list"]');
    const scrollTop = () => list.evaluate((el) => el.scrollTop);
    const bottomGap = () => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

    expect(await bottomGap()).toBeLessThan(3); // following the newest entry
    await expect(list.locator('[data-testid="event-log-row"]').last()).toContainText("Synthetic event 39");

    await list.hover();
    await page.mouse.wheel(0, -400); // scroll back toward older entries
    await page.waitForTimeout(100);
    const held = await scrollTop();
    expect(await bottomGap()).toBeGreaterThan(10);

    await push(40, 41); // a new entry while scrolled back must not move the view
    await page.waitForTimeout(200);
    expect(await scrollTop()).toBe(held);

    await page.mouse.wheel(0, 100000); // back to the bottom: following resumes
    await page.waitForTimeout(100);
    await push(41, 42);
    await page.waitForTimeout(200);
    expect(await bottomGap()).toBeLessThan(3);
  });

  test("T042: win screen shows an explicit floors-reached figure", async ({ page }) => {
    const wonSave = freshSave({ hasWon: true, completedFloorIds: [firstFloor.id] });
    await seedSave(page, wonSave);
    await page.goto("/");
    // A won save no longer offers "Continue" (002 FR-008a), so WinScreenScene is reached
    // directly here purely to exercise its own summary text, independent of menu navigation.
    await startScene(page, "WinScreenScene");

    const summaryText = await page.locator('[data-testid="win-summary"]').textContent();

    expect(summaryText).toContain(`Floors reached: ${TOWER.floors.length} of ${TOWER.floors.length}`);
  });
});
