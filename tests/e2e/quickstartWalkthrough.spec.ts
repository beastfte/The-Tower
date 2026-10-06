import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import {
  clearSave,
  waitForActiveScene,
  isSceneActive,
  getCtxSave,
  readSave,
  pressAndWait,
  dismissCombat,
  startFight,
} from "./helpers";

const firstFloor = TOWER.floors[0]!;

/**
 * Organic (real-play, not seeded-terminal-state) coverage for quickstart.md's remaining
 * browser-validation scenarios (tasks.md T057/T060, appended by /speckit-converge). Domain
 * logic for all of these is already unit-tested (T056); this file exercises it end-to-end
 * in a real browser, which was blocked earlier in this feature's implementation by a
 * sandbox Playwright/Chromium restriction that no longer applies.
 *
 * Scenario 7 (backtracking to a completed floor, FR-009a) is deliberately NOT covered here:
 * `backtrackToFloor` (src/domain/progress/towerProgress.ts) has no player-facing entry point
 * in any scene, so there is no way to organically trigger it in the browser. Flagged for a
 * follow-up /speckit-converge pass rather than faked with a non-UI test.
 */

test("scenario 10: movement is cardinal-only, one tile per keypress (FR-016)", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  let save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 0, y: 7 });

  await pressAndWait(page, "ArrowRight");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 1, y: 7 }); // exactly one tile, no diagonal

  // Unrecognized keys produce no movement at all.
  await pressAndWait(page, "KeyQ");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 1, y: 7 });
});

test("scenario 4: an under-leveled attempt now starts a fight instead of being blocked (027 FR-001)", async ({
  page,
}) => {
  // 027 replaced FR-004b's pre-combat refusal: any monster can be fought, even a losing fight.
  // Uses runtime placement (startFight) rather than this file's hard-coded floor-01 route.
  await clearSave(page);
  await page.goto("/");
  await startFight(page, {
    character: { baseStats: { damage: 1, defence: 0, hp: 15 }, currentHp: 15, bonusDamage: 0 },
    strongestEnemy: true,
  });
  expect(await isSceneActive(page, "CombatOverlay")).toBe(true);
  await expect(page.getByText("Too weak to fight this enemy")).toHaveCount(0);
});

test("scenario 6: quit and resume mid-floor (FR-010)", async ({ page }) => {
  // Not using clearSave here: it clears via page.addInitScript, which re-runs on every
  // navigation including the page.reload() below, wiping the save we're about to make
  // before "Continue" can read it back. A fresh Playwright test context already starts
  // with empty localStorage, so no explicit clear is needed before the first goto.
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage and defeat the goblin (base stats win easily)
  await waitForActiveScene(page, "CombatOverlay");
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7), goblin gone
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava damage (survivable)

  const beforeReload = await readSave(page);
  expect(beforeReload).not.toBeNull();
  expect(beforeReload!.currentFloorState.defeatedEnemyIds).toContain("floor01-goblin");
  expect(beforeReload!.currentFloorState.playerPosition).toEqual({ x: 4, y: 7 });
  expect(beforeReload!.character.currentHp).toBeLessThan(30);

  await page.reload();
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue
  await waitForActiveScene(page, "FloorScene");

  const afterResume = await getCtxSave(page);
  expect(afterResume.currentFloorState.playerPosition).toEqual(beforeReload!.currentFloorState.playerPosition);
  expect(afterResume.currentFloorState.defeatedEnemyIds).toEqual(beforeReload!.currentFloorState.defeatedEnemyIds);
  expect(afterResume.character.currentHp).toBe(beforeReload!.character.currentHp);
});

test("scenario 9: organic hazard death, checkpoint-resume, then a second death returned to the main menu (FR-013b/c/d, SC-010, SC-012)", async ({ page }) => {
  test.setTimeout(60_000);
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  // Defeat the goblin, collect the bronze key, then oscillate across the lava hazard
  // (floor01-lava at (4,7), 8 damage - 2 defence = 6 net) until HP reaches 0.
  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage goblin: HP 30 -> 28
  await waitForActiveScene(page, "CombatOverlay");
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), hazard: HP 28 -> 22
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7)
  await pressAndWait(page, "ArrowUp"); // collect the bronze key at (5,6) (022 US1: logged only, no modal)
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowLeft"); // (5,7) -> (4,7), hazard: HP 22 -> 16
  await pressAndWait(page, "ArrowLeft"); // (4,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), hazard: HP 16 -> 10
  await pressAndWait(page, "ArrowLeft"); // (4,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), hazard: HP 10 -> 4
  await pressAndWait(page, "ArrowLeft"); // (4,7) -> (3,7)
  await page.keyboard.press("ArrowRight"); // (3,7) -> (4,7), hazard: HP 4 -> 0, dies
  await waitForActiveScene(page, "DeathScreenScene");

  const preDeath = await readSave(page);
  expect(preDeath!.character.currency).toBe(15); // goblin's drop
  expect(preDeath!.character.keyIds).toContain("bronze");

  // Choice 1: resume from last checkpoint.
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  let save = await getCtxSave(page);
  expect(save.isDead).toBe(false);
  expect(save.currentFloorState.defeatedEnemyIds).toEqual([]); // the failed attempt is reset
  expect(save.currentFloorState.collectedItemIds).toEqual([]);
  expect(save.currentFloorState.playerPosition).toEqual(firstFloor.entrance);
  expect(save.character.currentHp).toBe(30); // restored to max HP
  expect(save.character.currency).toBe(15); // unchanged from just before death
  expect(save.character.keyIds).toContain("bronze"); // unchanged from just before death

  // Die a second time (the goblin and hazard are both back after the reset above),
  // this time choosing "return to main menu".
  await pressAndWait(page, "ArrowRight");
  await pressAndWait(page, "ArrowRight");
  await page.keyboard.press("ArrowRight"); // engage goblin again: HP 30 -> 28
  await waitForActiveScene(page, "CombatOverlay");
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight");
  await pressAndWait(page, "ArrowRight"); // hazard: HP 28 -> 22
  await pressAndWait(page, "ArrowLeft");
  await pressAndWait(page, "ArrowRight"); // hazard: HP 22 -> 16
  await pressAndWait(page, "ArrowLeft");
  await pressAndWait(page, "ArrowRight"); // hazard: HP 16 -> 10
  await pressAndWait(page, "ArrowLeft");
  await pressAndWait(page, "ArrowRight"); // hazard: HP 10 -> 4
  await pressAndWait(page, "ArrowLeft");
  await page.keyboard.press("ArrowRight"); // hazard: HP 4 -> 0, dies
  await waitForActiveScene(page, "DeathScreenScene");

  // Choice 2: return to main menu — must not alter the save at all.
  await page.keyboard.press("Escape");
  await waitForActiveScene(page, "MainMenuScene");

  save = await getCtxSave(page);
  expect(save.isDead).toBe(false);
  expect(save.currentFloorState.defeatedEnemyIds).toContain("floor01-goblin"); // frozen at death, not reset
  expect(save.currentFloorState.playerPosition).toEqual({ x: 4, y: 7 });
  expect(save.character.currentHp).toBe(0); // "without modifying the save at all"

  // Continuing from the menu resumes exactly where the player was just before death.
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 4, y: 7 });
  expect(save.character.currentHp).toBe(0);
});

test("scenario 11: organically defeating the end boss triggers the win state (FR-011, FR-011a, SC-008)", async ({ page }) => {
  test.setTimeout(60_000);
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  // Clear floor-01 end to end: defeat the goblin, cross the lava once, collect the
  // bronze key, pass the now-unlocked door, collect the gold pile, exit.
  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage goblin
  await waitForActiveScene(page, "CombatOverlay");
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava damage (survivable)
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7)
  await pressAndWait(page, "ArrowUp"); // collect bronze key at (5,6) (022 US1: logged only, no modal)
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), bronze door now unlocked
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), gold pile
  for (let x = 7; x < 14; x++) {
    await pressAndWait(page, "ArrowRight"); // walk the rest of the corridor to the exit at (14,7)
  }

  // Reaching the exit completes floor-01 and advances to floor-final.
  await waitForActiveScene(page, "FloorScene", 10_000);
  let save = await getCtxSave(page);
  expect(save.currentFloorId).toBe("floor-final");
  expect(save.currentFloorState.playerPosition).toEqual({ x: 0, y: 7 });

  // Walk to the end boss at (7,7) and defeat it.
  for (let x = 0; x < 6; x++) {
    await pressAndWait(page, "ArrowRight");
  }
  await page.keyboard.press("ArrowRight"); // engage the end boss
  await waitForActiveScene(page, "CombatOverlay");
  // 027 (C14): Continue on the victory panel leads straight to the win screen.
  await dismissCombat(page);
  await waitForActiveScene(page, "WinScreenScene", 10_000);

  save = await getCtxSave(page);
  expect(save.hasWon).toBe(true);
});
