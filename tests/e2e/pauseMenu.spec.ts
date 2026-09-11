import { test, expect } from "@playwright/test";
import {
  clearSave,
  waitForActiveScene,
  isSceneActive,
  getCtxSave,
  readSave,
  pressAndWait,
} from "./helpers";

/** 003 US1 (FR-001-FR-004, FR-007-FR-009, SC-001, SC-002): opening/closing the pause menu,
 * via both the side-panel control and ESC, leaves gameplay state completely unchanged, and
 * has no effect while another blocking screen (combat, a pickup modal) is already showing. */
test.describe("Pause menu — open and close", () => {
  test("opens via the side-panel button, blocks movement, and Resume leaves state unchanged", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    const before = await getCtxSave(page);

    await page.locator('[data-testid="pause-button"]').click();
    await waitForActiveScene(page, "PauseMenuScene");
    expect(await isSceneActive(page, "FloorScene")).toBe(false); // paused, not stopped

    // Movement input must be blocked while the pause menu is open.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "PauseMenuScene")).toBe(true);

    await page.getByText("[ Resume ] (Esc)").click();
    await waitForActiveScene(page, "FloorScene");

    const after = await getCtxSave(page);
    expect(after.currentFloorState.playerPosition).toEqual(before.currentFloorState.playerPosition);
    expect(after.character.currentHp).toBe(before.character.currentHp);
  });

  test("opens via ESC, and ESC again closes it with state unchanged", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    const before = await getCtxSave(page);

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "FloorScene");

    const after = await getCtxSave(page);
    expect(after).toEqual(before);
  });

  test("rapid repeated open/close has no cumulative effect", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    const before = await getCtxSave(page);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Escape");
      await waitForActiveScene(page, "PauseMenuScene");
      await page.keyboard.press("Escape");
      await waitForActiveScene(page, "FloorScene");
    }

    expect(await getCtxSave(page)).toEqual(before);
  });

  test("neither the side-panel button nor ESC has any effect during a combat encounter (FR-008)", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    await pressAndWait(page, "ArrowRight"); // (1,2) -> (2,2)
    await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,2)
    await waitForActiveScene(page, "CombatOverlay");

    await page.keyboard.press("Escape");
    await page.locator('[data-testid="pause-button"]').click();
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "PauseMenuScene")).toBe(false);
    expect(await isSceneActive(page, "CombatOverlay")).toBe(true);

    await waitForActiveScene(page, "FloorScene", 10_000); // let combat resolve normally
  });

  test("neither the side-panel button nor ESC has any effect during a pickup modal (FR-008)", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    await pressAndWait(page, "ArrowRight"); // (1,2) -> (2,2)
    await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,2)
    await waitForActiveScene(page, "CombatOverlay");
    await waitForActiveScene(page, "FloorScene", 10_000);

    await pressAndWait(page, "ArrowRight"); // (2,2) -> (3,2), goblin defeated
    await pressAndWait(page, "ArrowRight"); // (3,2) -> (4,2), hazard damage
    await pressAndWait(page, "ArrowRight"); // (4,2) -> (5,2)
    await page.keyboard.press("ArrowUp"); // (5,2) -> (5,1), bronze key
    await waitForActiveScene(page, "PickupModalScene");

    await page.keyboard.press("Escape");
    await page.locator('[data-testid="pause-button"]').click();
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "PauseMenuScene")).toBe(false);
    expect(await isSceneActive(page, "PickupModalScene")).toBe(true);

    await page.keyboard.press("Enter"); // dismiss
    await waitForActiveScene(page, "FloorScene");
  });
});

/** 003 US2 (FR-005, SC-003): "Restart at last checkpoint" undoes the current attempt at
 * this floor only — earlier completed floors and permanent character progress are untouched. */
test.describe("Pause menu — restart at last checkpoint", () => {
  test("resets the current floor to its entrance at full HP, undoing this attempt's progress", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    await pressAndWait(page, "ArrowRight"); // (1,2) -> (2,2)
    await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,2)
    await waitForActiveScene(page, "CombatOverlay");
    await waitForActiveScene(page, "FloorScene", 10_000);
    await pressAndWait(page, "ArrowRight"); // (2,2) -> (3,2), goblin defeated

    const beforeRestart = await getCtxSave(page);
    expect(beforeRestart.currentFloorState.defeatedEnemyIds.length).toBeGreaterThan(0);
    expect(beforeRestart.character.currentHp).toBeLessThan(30);

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");
    await page.keyboard.press("Enter"); // "Restart at last checkpoint"
    await waitForActiveScene(page, "FloorScene");

    const afterRestart = await getCtxSave(page);
    expect(afterRestart.currentFloorState.playerPosition).toEqual({ x: 0, y: 10 }); // floor-01's entrance
    expect(afterRestart.currentFloorState.defeatedEnemyIds).toHaveLength(0);
    expect(afterRestart.character.currentHp).toBe(30);
  });

  test("leaves earlier completed floors and permanent progress untouched", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    // Collect the bronze key (permanent character progress) before restarting.
    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    await pressAndWait(page, "ArrowRight"); // (1,2) -> (2,2)
    await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,2)
    await waitForActiveScene(page, "CombatOverlay");
    await waitForActiveScene(page, "FloorScene", 10_000);
    await pressAndWait(page, "ArrowRight"); // (2,2) -> (3,2)
    await pressAndWait(page, "ArrowRight"); // (3,2) -> (4,2), hazard
    await pressAndWait(page, "ArrowRight"); // (4,2) -> (5,2)
    await page.keyboard.press("ArrowUp"); // (5,2) -> (5,1), bronze key
    await waitForActiveScene(page, "PickupModalScene");
    await page.keyboard.press("Enter"); // dismiss
    await waitForActiveScene(page, "FloorScene");

    const beforeRestart = await getCtxSave(page);
    expect(beforeRestart.character.keyIds).toContain("bronze");

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");
    await page.keyboard.press("Enter"); // "Restart at last checkpoint"
    await waitForActiveScene(page, "FloorScene");

    const afterRestart = await getCtxSave(page);
    expect(afterRestart.character.keyIds).toContain("bronze"); // permanent, untouched by a floor restart
  });
});

/** 003 US3 (FR-006, SC-004): "Return to main menu" preserves the save exactly as it stood. */
test.describe("Pause menu — return to main menu", () => {
  test("lands on the main menu and Continue resumes exactly where play was paused", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
    const before = await getCtxSave(page);

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");
    await page.keyboard.press("KeyM"); // "Return to main menu"
    await waitForActiveScene(page, "MainMenuScene");

    const savedAfterReturn = await readSave(page);
    expect(savedAfterReturn?.currentFloorState.playerPosition).toEqual(before.currentFloorState.playerPosition);
    expect(savedAfterReturn?.character.currentHp).toBe(before.character.currentHp);

    await page.keyboard.press("Enter"); // "Continue"
    await waitForActiveScene(page, "FloorScene");
    const resumed = await getCtxSave(page);
    expect(resumed.currentFloorState.playerPosition).toEqual(before.currentFloorState.playerPosition);
    expect(await isSceneActive(page, "SidePanelScene")).toBe(true);
    expect(await isSceneActive(page, "EventLogScene")).toBe(true);
  });
});
