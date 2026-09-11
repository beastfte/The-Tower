import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import type { PlayerSave } from "../../src/domain/character/save";
import { seedSave, waitForActiveScene, gameToPage, startScene } from "./helpers";

const firstFloor = TOWER.floors[0]!;

function freshSave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return { ...createInitialPlayerSave(firstFloor.id, firstFloor.entrance), ...overrides };
}

/** Regression coverage for the 3 gaps /speckit-converge found (tasks.md T040-T042). */
test.describe("Convergence fixes", () => {
  test("T040: side panel scrolls once the itemized list overflows its visible height", async ({ page }) => {
    await seedSave(page, freshSave());
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    // Force overflow: far more inventory entries than fit in the panel's 280px height.
    await page.evaluate(() => {
      const win = window as unknown as {
        __game: { registry: { get: (k: string) => { save: PlayerSave } } };
      };
      const ctx = win.__game.registry.get("ctx");
      for (let i = 0; i < 40; i++) ctx.save.character.inventory.push(`synthetic-loot-${i}`);
    });
    await page.waitForTimeout(200); // let SidePanelScene's update() notice the signature change

    const rowsScrollTop = () => page.locator('[data-testid="side-panel-rows"]').evaluate((el) => el.scrollTop);

    expect(await rowsScrollTop()).toBe(0); // not scrolled yet

    const { x, y } = await gameToPage(page, 300, 100); // hover over the side panel
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 400); // scroll down (toward later items)
    await page.waitForTimeout(100);

    expect(await rowsScrollTop()).toBeGreaterThan(0); // scrolled down to reveal lower rows
  });

  test("T041: event log can scroll back to entries older than the visible window", async ({ page }) => {
    await seedSave(page, freshSave());
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    // Seed more log entries than MAX_VISIBLE_LINES (4) directly via the test hook.
    await page.evaluate(() => {
      const win = window as unknown as {
        __game: { registry: { get: (k: string) => { eventLog: { id: string; timestamp: number; kind: string; message: string }[] } } };
      };
      const log = win.__game.registry.get("ctx").eventLog;
      for (let i = 0; i < 8; i++) {
        log.push({ id: `synthetic-${i}`, timestamp: Date.now(), kind: "pickup", message: `Synthetic event ${i}` });
      }
    });
    await page.waitForTimeout(200);

    const logText = () => page.locator('[data-testid="event-log-text"]').textContent();

    const before = await logText();
    expect(before).toContain("Synthetic event 7"); // most recent, visible by default
    expect(before).not.toContain("Synthetic event 0"); // oldest, not yet visible

    const { x, y } = await gameToPage(page, 100, 250); // hover over the event log area
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -400); // scroll up (toward older entries)
    await page.waitForTimeout(100);

    const after = await logText();
    expect(after).toContain("scrolled");
    expect(after).not.toBe(before);
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
