import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import type { PlayerSave } from "../../src/domain/character/save";
import {
  clearSave,
  seedSave,
  readSave,
  getCtxSave,
  isSceneActive,
  waitForActiveScene,
  gameToPage,
  startScene,
} from "./helpers";

const firstFloor = TOWER.floors[0]!;

function freshSave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return { ...createInitialPlayerSave(firstFloor.id, firstFloor.entrance), ...overrides };
}

/** 002 US2: every screen offering a choice is clearly labeled and dual-input operable
 * (FR-008/FR-008a/FR-009/FR-010/FR-010a/FR-011). */
test.describe("Main menu", () => {
  test("with no save, Continue has no effect and New Game (keyboard) starts a fresh game", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    // FR-008: no save exists, so Enter (Continue's key) must do nothing.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "MainMenuScene")).toBe(true);
    expect(await isSceneActive(page, "FloorScene")).toBe(false);

    // New Game via keyboard (FR-011 keyboard path).
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");
    expect(await readSave(page)).not.toBeNull();
  });

  test("New Game is reachable via pointer too (FR-011)", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    const { x, y } = await gameToPage(page, 180, 140 + 24); // New Game sits 24px below Continue's y
    await page.mouse.click(x, y);
    await waitForActiveScene(page, "FloorScene");
  });

  test("with an existing (unwon) save, Continue (keyboard) resumes floor exploration", async ({ page }) => {
    await seedSave(page, freshSave());
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");
  });

  test("with a won save, Continue is not offered — only New Game (FR-008a)", async ({ page }) => {
    await seedSave(page, freshSave({ hasWon: true, character: { ...freshSave().character, currency: 42 } }));
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    // FR-008a: a won save offers no "Continue" at all, so Enter (its key) must do nothing.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "MainMenuScene")).toBe(true);
    expect(await isSceneActive(page, "WinScreenScene")).toBe(false);
    expect(await isSceneActive(page, "FloorScene")).toBe(false);

    // New Game is still offered and overwrites the won save with a fresh one.
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");
    const freshState = await getCtxSave(page);
    expect(freshState.hasWon).toBe(false);
  });
});

test.describe("Win screen return-to-menu round trip", () => {
  test("returning to the main menu does not alter the save (FR-010a, SC-010)", async ({ page }) => {
    const wonSave = freshSave({ hasWon: true, character: { ...freshSave().character, currency: 99 } });
    await seedSave(page, wonSave);
    await page.goto("/");
    // A won save no longer offers "Continue" (FR-008a), so WinScreenScene is reached directly
    // here purely to exercise its own "return to main menu" behavior in isolation.
    await startScene(page, "WinScreenScene");

    // Return to main menu via keyboard (Esc).
    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "MainMenuScene");

    const saveAfterReturn = await getCtxSave(page);
    expect(saveAfterReturn.hasWon).toBe(true);
    expect(saveAfterReturn.character.currency).toBe(99);

    // FR-008a: back on the main menu, the (still-won) save offers no "Continue" — only New Game.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "MainMenuScene")).toBe(true);
  });

  test("the return-to-menu option is reachable via pointer too (FR-011)", async ({ page }) => {
    await seedSave(page, freshSave({ hasWon: true }));
    await page.goto("/");
    await startScene(page, "WinScreenScene");

    // WinScreenScene.ts places the option at (width/2, height*3/4) in game space (360x280 base).
    const { x, y } = await gameToPage(page, 180, 210);
    await page.mouse.click(x, y);
    await waitForActiveScene(page, "MainMenuScene");
  });
});

test.describe("Death screen", () => {
  test("boots straight into the death screen when the save was left mid-death, and both choices are dual-input operable (FR-009)", async ({
    page,
  }) => {
    const deadSave = freshSave({ isDead: true, character: { ...freshSave().character, currentHp: 0 } });
    await seedSave(page, deadSave);
    await page.goto("/");
    await waitForActiveScene(page, "DeathScreenScene");
    // Regression check: MainMenuScene auto-starts as the game's first configured scene;
    // the boot-time routing to DeathScreenScene (main.ts) must stop it, not just start
    // DeathScreenScene on top of it (previously both rendered simultaneously, overlapping).
    expect(await isSceneActive(page, "MainMenuScene")).toBe(false);

    // Resume from checkpoint (Enter) -> FloorScene, isDead cleared, HP restored.
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");
    const resumed = await getCtxSave(page);
    expect(resumed.isDead).toBe(false);
    expect(resumed.character.currentHp).toBeGreaterThan(0);
  });

  test("return to main menu (pointer) clears the death state without resetting other progress", async ({
    page,
  }) => {
    const deadSave = freshSave({
      isDead: true,
      character: { ...freshSave().character, currentHp: 0, currency: 7 },
    });
    await seedSave(page, deadSave);
    await page.goto("/");
    await waitForActiveScene(page, "DeathScreenScene");

    // DeathScreenScene.ts places "return to main menu" at (width/2, height/2 + 24).
    const { x, y } = await gameToPage(page, 180, 140 + 24);
    await page.mouse.click(x, y);
    await waitForActiveScene(page, "MainMenuScene");

    const afterReturn = await readSave(page);
    expect(afterReturn?.isDead).toBe(false);
    expect(afterReturn?.character.currency).toBe(7);
  });
});
