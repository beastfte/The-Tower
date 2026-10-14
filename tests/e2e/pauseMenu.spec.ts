import { test, expect, type Page } from "@playwright/test";
import {
  clearSave,
  waitForActiveScene,
  isSceneActive,
  getCtxSave,
  readSave,
  pressAndWait,
  dismissCombat,
  startFight,
  startScene,
} from "./helpers";

/** 003 US1 (FR-001-FR-004, FR-007-FR-009, SC-001, SC-002): opening/closing the pause menu,
 * via both the side-panel control and ESC, leaves gameplay state completely unchanged, and
 * has no effect while another blocking screen (combat) is already showing. 022 US1 removed the
 * pickup modal entirely, so there is no longer a second blocking-screen case to cover here. */
test.describe("Pause menu — open and close", () => {
  test("opens via the side-panel button, blocks movement, and Resume leaves state unchanged", async ({
    page,
  }) => {
    await clearSave(page);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
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
    // 027: runtime placement instead of a hard-coded floor-01 route (which broke on redesign).
    await startFight(page, { character: { baseStats: { damage: 100_000, defence: 100_000, hp: 30 }, currentHp: 30 } });

    // 027 (contract C12): the combat modal binds no keys at all, and the paused FloorScene can't
    // receive Escape, so this press does nothing. The side-panel pause button is ignored while
    // CombatOverlay is active (contract C8: no pausing mid-fight).
    await page.keyboard.press("Escape");
    await page.locator('[data-testid="pause-button"]').click();
    await page.waitForTimeout(200);
    expect(await isSceneActive(page, "PauseMenuScene")).toBe(false);
    expect(await isSceneActive(page, "CombatOverlay")).toBe(true);

    await dismissCombat(page); // 022 US2: combat no longer closes itself
    await waitForActiveScene(page, "FloorScene", 10_000);
  });
});

/** What the player had when the floor attempt began (the checkpoint snapshot) versus what they
 * have by the time they restart. Staged in memory on a normal new game, so these tests don't walk
 * the live tower's layout (project rule: tests must not depend on tower content). */
const AT_ENTRY = { currentHp: 7, currency: 5, keyIds: [] as string[], potionCount: 2 };
const LATER = { currentHp: 1, currency: 90, keyIds: ["bronze"], potionCount: 0 };

/** Starts a new game, then stages "entered this floor with AT_ENTRY, since then LATER and some
 * floor progress". Returns the floor's real entrance, read at runtime. */
async function stageAttempt(page: Page): Promise<{ x: number; y: number }> {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");
  return page.evaluate(
    ({ entry, later }) => {
      type Ctx = { currentFloor: { entrance: { x: number; y: number } }; save: Record<string, any> };
      const ctx = (window as unknown as { __game: { registry: { get: (k: string) => Ctx } } }).__game.registry.get("ctx");
      const snapshot = { ...ctx.save.character, ...entry };
      ctx.save = {
        ...ctx.save,
        checkpointCharacter: snapshot,
        character: { ...snapshot, ...later },
        currentFloorState: {
          ...ctx.save.currentFloorState,
          defeatedEnemyIds: ["e2e-defeated"],
          collectedItemIds: ["e2e-collected"],
          playerPosition: { x: -5, y: -5 },
        },
      };
      return ctx.currentFloor.entrance;
    },
    { entry: AT_ENTRY, later: LATER },
  );
}

/** 003 US2 (FR-005, SC-003): "Restart at last checkpoint" undoes the current attempt at
 * this floor only — earlier completed floors and permanent character progress are untouched.
 * bug fix: checkpoint-resume-state — and it returns the HP the floor was entered with, not full HP. */
test.describe("Pause menu — restart at last checkpoint", () => {
  test("returns to the entrance with the HP and gear the floor was entered with, undoing this attempt", async ({ page }) => {
    const entrance = await stageAttempt(page);
    expect((await getCtxSave(page)).character.currentHp).toBe(LATER.currentHp);

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");
    await page.keyboard.press("Enter"); // "Restart at last checkpoint"
    await waitForActiveScene(page, "FloorScene");

    const after = await getCtxSave(page);
    expect(after.currentFloorState.playerPosition).toEqual(entrance);
    expect(after.currentFloorState.defeatedEnemyIds).toHaveLength(0);
    expect(after.currentFloorState.collectedItemIds).toHaveLength(0);
    expect(after.character.currentHp).toBe(AT_ENTRY.currentHp); // not full HP
    expect(after.character.currency).toBe(AT_ENTRY.currency);
    expect(after.character.potionCount).toBe(AT_ENTRY.potionCount);
  });

  // bug fix: checkpoint-restart-stat-exploit — a key (or any other pickup) collected during
  // the *current, not-yet-completed* floor attempt is not "permanent" progress per FR-005
  // ("undoing only what happened during the current attempt at this floor"); only progress
  // from floors already frozen into completedFloorStates is permanent.
  test("reverts a key (or any other pickup) collected during the current, uncompleted attempt", async ({ page }) => {
    await stageAttempt(page);
    expect((await getCtxSave(page)).character.keyIds).toContain("bronze");

    await page.keyboard.press("Escape");
    await waitForActiveScene(page, "PauseMenuScene");
    await page.keyboard.press("Enter"); // "Restart at last checkpoint"
    await waitForActiveScene(page, "FloorScene");

    expect((await getCtxSave(page)).character.keyIds).not.toContain("bronze");
  });

  // bug fix: checkpoint-resume-state — the death screen's Resume uses the same snapshot.
  test("Resume from the death screen also returns the HP the floor was entered with", async ({ page }) => {
    await stageAttempt(page);
    await page.evaluate(() => {
      const ctx = (window as unknown as { __game: { registry: { get: (k: string) => { save: Record<string, any> } } } }).__game.registry.get("ctx");
      ctx.save = { ...ctx.save, isDead: true, character: { ...ctx.save.character, currentHp: 0 } };
    });
    await startScene(page, "DeathScreenScene");
    await page.getByRole("button", { name: /Resume from last checkpoint/ }).click();
    await waitForActiveScene(page, "FloorScene");

    const after = await getCtxSave(page);
    expect(after.isDead).toBe(false);
    expect(after.character.currentHp).toBe(AT_ENTRY.currentHp);
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

    await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
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
