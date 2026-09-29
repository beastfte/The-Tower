import { test, expect } from "@playwright/test";
import {
  clearSave,
  waitForActiveScene,
  isSceneActive,
  getEventLog,
  getCtxSave,
  pressAndWait,
  dismissCombat,
} from "./helpers";

/**
 * Plays a deterministic path through `floor-01` (src/data/floors/floor-01.ts, resized to
 * 15x15 by feature 014) to exercise, with real gameplay rather than seeded state:
 *  - US3 (FR-012/FR-013): the compulsory goblin fight, and the side panel (US1/FR-007)
 *    staying visible throughout.
 *  - 022 US1: no blocking pickup modal for the bronze key or the plain currency pile — both are
 *    logged only, and play never pauses for either.
 *  - US5 (FR-015-FR-017): the event log gets a "combat" entry (folding in the goblin's
 *    currency drop, bug fix currency-not-logged), a "pickup" entry for the bronze key, and a
 *    second "pickup" entry for the standalone gold pile, in that order.
 *
 * Path: (0,7) start -> right x2 -> engage goblin at (3,7) -> right through the (4,7) lava
 * tile -> right to the safe (5,7) tile -> up to collect the bronze key at (5,6) -> down ->
 * right through the now-unlocked bronze door at (6,7) -> right over the gold pile at (7,7).
 * Deliberately stops short of the exit to avoid floor completion/restart, which is out of
 * this test's scope.
 */
test("floor-01 walkthrough: combat, uninterrupted pickups, and event log population", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)

  // (2,7) -> (3,7) is blocked by the compulsory goblin: engaging launches CombatOverlay.
  await page.keyboard.press("ArrowRight");
  await waitForActiveScene(page, "CombatOverlay");

  // US1/FR-007: the side panel and event log stay visible and unobstructed during combat.
  expect(await isSceneActive(page, "SidePanelScene")).toBe(true);
  expect(await isSceneActive(page, "EventLogScene")).toBe(true);
  expect(await isSceneActive(page, "FloorScene")).toBe(false); // paused, not stopped

  // Combat plays out turn-by-turn (CombatOverlay.ts); 022 US2: it no longer closes itself, so a
  // key press is needed before FloorScene resumes.
  await dismissCombat(page);
  await waitForActiveScene(page, "FloorScene", 10_000);

  let log = await getEventLog(page);
  expect(log).toHaveLength(1);
  expect(log[0]!.kind).toBe("combat");
  // bug fix: currency-not-logged — the goblin's currency drop is folded into this entry.
  expect(log[0]!.message).toContain("Found 15 gold.");

  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7), goblin defeated
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava damage (survivable)
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7), safe

  // (5,7) -> (5,6): the bronze key. 022 US1: no modal — logged only, play continues at once.
  await pressAndWait(page, "ArrowUp");
  expect(await isSceneActive(page, "FloorScene")).toBe(true);

  log = await getEventLog(page);
  expect(log).toHaveLength(2);
  expect(log[1]!.kind).toBe("pickup");

  let save = await getCtxSave(page);
  expect(save.character.keyIds).toContain("bronze");

  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), bronze door now unlocked
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), plain currency pile (no modal)

  // 022 US1: still no modal for the plain currency pickup — logged only, same as the key above.
  expect(await isSceneActive(page, "FloorScene")).toBe(true);
  log = await getEventLog(page);
  expect(log).toHaveLength(3);
  expect(log[2]!.kind).toBe("pickup");
  expect(log[2]!.message).toContain("10 gold");

  save = await getCtxSave(page);
  expect(save.character.currency).toBe(25); // 15 (goblin drop) + 10 (gold pile)
  expect(save.character.currentHp).toBeGreaterThan(0);
  expect(save.character.currentHp).toBeLessThan(30); // took lava (and possibly combat) damage
});
