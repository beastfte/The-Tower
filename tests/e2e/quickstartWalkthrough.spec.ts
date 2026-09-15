import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import type { PlayerSave } from "../../src/domain/character/save";
import { clearSave, seedSave, waitForActiveScene, isSceneActive, getCtxSave, readSave, pressAndWait } from "./helpers";

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
  expect(save.currentFloorState.playerPosition).toEqual({ x: 0, y: 10 });

  await pressAndWait(page, "ArrowRight");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 1, y: 10 }); // exactly one tile, no diagonal

  // Unrecognized keys produce no movement at all.
  await pressAndWait(page, "KeyQ");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 1, y: 10 });
});

test("scenario 4: an under-leveled attempt is blocked (FR-004b)", async ({ page }) => {
  // 006: this scenario previously continued into "scenario 5" (a collected powerup raising
  // damage enough to unlock the same engagement) — the powerup mechanic was removed entirely
  // per that feature's spec, so this test now only covers the still-true blocking half.
  // Deliberately weak stats: this character loses to floor01-goblin (dmg4/def1/hp12) as-is.
  const weakSave: PlayerSave = {
    ...createInitialPlayerSave(firstFloor.id, firstFloor.entrance),
    character: {
      ...createInitialPlayerSave(firstFloor.id, firstFloor.entrance).character,
      baseStats: { damage: 3, defence: 0, hp: 15 },
      currentHp: 15,
    },
  };
  await seedSave(page, weakSave);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue with the seeded weak save
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)

  // Engaging the goblin now would lose the simulated encounter — blocked before it
  // starts, no combat animation, HP untouched.
  await pressAndWait(page, "ArrowRight");
  expect(await isSceneActive(page, "CombatOverlay")).toBe(false);
  expect(await isSceneActive(page, "FloorScene")).toBe(true);
  const save = await getCtxSave(page);
  expect(save.character.currentHp).toBe(15);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 2, y: 10 }); // never moved
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

  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage and defeat the goblin (base stats win easily)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,10) -> (3,10), goblin gone
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), hazard damage (survivable)

  const beforeReload = await readSave(page);
  expect(beforeReload).not.toBeNull();
  expect(beforeReload!.currentFloorState.defeatedEnemyIds).toContain("floor01-goblin");
  expect(beforeReload!.currentFloorState.playerPosition).toEqual({ x: 4, y: 10 });
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
  // (floor01-lava at (4,10), 8 damage - 2 defence = 6 net) until HP reaches 0.
  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage goblin: HP 30 -> 28
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), hazard: HP 28 -> 22
  await pressAndWait(page, "ArrowRight"); // (4,10) -> (5,10)
  await page.keyboard.press("ArrowUp"); // collect the bronze key at (5,9)
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (5,9) -> (5,10)
  await pressAndWait(page, "ArrowLeft"); // (5,10) -> (4,10), hazard: HP 22 -> 16
  await pressAndWait(page, "ArrowLeft"); // (4,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), hazard: HP 16 -> 10
  await pressAndWait(page, "ArrowLeft"); // (4,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), hazard: HP 10 -> 4
  await pressAndWait(page, "ArrowLeft"); // (4,10) -> (3,10)
  await page.keyboard.press("ArrowRight"); // (3,10) -> (4,10), hazard: HP 4 -> 0, dies
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
  expect(save.currentFloorState.playerPosition).toEqual({ x: 4, y: 10 });
  expect(save.character.currentHp).toBe(0); // "without modifying the save at all"

  // Continuing from the menu resumes exactly where the player was just before death.
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  save = await getCtxSave(page);
  expect(save.currentFloorState.playerPosition).toEqual({ x: 4, y: 10 });
  expect(save.character.currentHp).toBe(0);
});

test("scenario 11: organically defeating the end boss triggers the win state (FR-011, FR-011a, SC-008)", async ({ page }) => {
  test.setTimeout(60_000);
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  // Clear floor-01 end to end: defeat the goblin, cross the hazard once, collect the
  // bronze key, pass the now-unlocked door, collect the gold pile and loot torch, exit.
  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage goblin
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);
  await pressAndWait(page, "ArrowRight"); // (2,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), hazard damage (survivable)
  await pressAndWait(page, "ArrowRight"); // (4,10) -> (5,10)
  await page.keyboard.press("ArrowUp"); // collect bronze key at (5,9)
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (5,9) -> (5,10)
  await pressAndWait(page, "ArrowRight"); // (5,10) -> (6,10), bronze door now unlocked
  await pressAndWait(page, "ArrowRight"); // (6,10) -> (7,10), gold pile
  await pressAndWait(page, "ArrowRight"); // (7,10) -> (8,10)
  await pressAndWait(page, "ArrowUp"); // collect loot torch at (8,9) — plain loot, no modal
  await pressAndWait(page, "ArrowDown"); // (8,9) -> (8,10)
  for (let x = 8; x < 19; x++) {
    await pressAndWait(page, "ArrowRight"); // walk the rest of the corridor to the exit at (19,10)
  }

  // Reaching the exit completes floor-01 and advances to floor-final.
  await waitForActiveScene(page, "FloorScene", 10_000);
  let save = await getCtxSave(page);
  expect(save.currentFloorId).toBe("floor-final");
  expect(save.currentFloorState.playerPosition).toEqual({ x: 0, y: 10 });

  // Walk to the end boss at (10,10) and defeat it.
  for (let x = 0; x < 9; x++) {
    await pressAndWait(page, "ArrowRight");
  }
  await page.keyboard.press("ArrowRight"); // engage the end boss
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "WinScreenScene", 10_000);

  save = await getCtxSave(page);
  expect(save.hasWon).toBe(true);
});
