import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, isSceneActive, getEventLog, getCtxSave, pressAndWait } from "./helpers";

/**
 * Plays a deterministic path through `floor-01` (src/data/floors/floor-01.ts) to exercise,
 * with real gameplay rather than seeded state:
 *  - US3 (FR-012/FR-013): the compulsory goblin fight, and the side panel (US1/FR-007)
 *    staying visible throughout.
 *  - US4 (FR-018/FR-019): a blocking pickup modal for the bronze key (not for the plain
 *    currency pile or loot torch, which must NOT trigger one).
 *  - US5 (FR-015-FR-017): the event log gets exactly one "combat" entry and one "pickup"
 *    entry, in that order, and no entries for the loot/currency pickups.
 *
 * Path: (0,2) start -> right x2 -> engage goblin at (3,2) -> right through the (4,2) hazard
 * -> right to (5,2) -> up to collect the bronze key at (5,1) -> down -> right through the
 * now-unlocked bronze door at (6,2) -> right over the gold pile at (7,2). Deliberately stops
 * short of the exit to avoid floor completion/restart, which is out of this test's scope.
 * 013 removed the loot torch that used to sit one tile further on (retired — torches are no
 * longer a collectible pickup), so this walkthrough no longer continues past the gold pile.
 */
test("floor-01 walkthrough: combat, blocking pickup modal, and event log population", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowRight"); // (0,2) -> (1,2)
  await pressAndWait(page, "ArrowRight"); // (1,2) -> (2,2)

  // (2,2) -> (3,2) is blocked by the compulsory goblin: engaging launches CombatOverlay.
  await page.keyboard.press("ArrowRight");
  await waitForActiveScene(page, "CombatOverlay");

  // US1/FR-007: the side panel and event log stay visible and unobstructed during combat.
  expect(await isSceneActive(page, "SidePanelScene")).toBe(true);
  expect(await isSceneActive(page, "EventLogScene")).toBe(true);
  expect(await isSceneActive(page, "FloorScene")).toBe(false); // paused, not stopped

  // Combat plays out turn-by-turn (CombatOverlay.ts) and resumes FloorScene on completion.
  await waitForActiveScene(page, "FloorScene", 10_000);

  let log = await getEventLog(page);
  expect(log).toHaveLength(1);
  expect(log[0]!.kind).toBe("combat");

  await pressAndWait(page, "ArrowRight"); // (2,2) -> (3,2), goblin defeated
  await pressAndWait(page, "ArrowRight"); // (3,2) -> (4,2), hazard damage (survivable)
  await pressAndWait(page, "ArrowRight"); // (4,2) -> (5,2)

  // (5,2) -> (5,1): the bronze key. A blocking pickup modal must appear before play resumes.
  await page.keyboard.press("ArrowUp");
  await waitForActiveScene(page, "PickupModalScene");
  expect(await isSceneActive(page, "FloorScene")).toBe(false); // FR-019: blocked until dismissed

  await page.keyboard.press("Enter"); // dismiss
  await waitForActiveScene(page, "FloorScene");

  log = await getEventLog(page);
  expect(log).toHaveLength(2);
  expect(log[1]!.kind).toBe("pickup");

  let save = await getCtxSave(page);
  expect(save.character.keyIds).toContain("bronze");

  await pressAndWait(page, "ArrowDown"); // (5,1) -> (5,2)
  await pressAndWait(page, "ArrowRight"); // (5,2) -> (6,2), bronze door now unlocked
  await pressAndWait(page, "ArrowRight"); // (6,2) -> (7,2), plain currency pile (no modal)

  // FR-018: no modal, and no new log entry, for the plain currency pickup.
  expect(await isSceneActive(page, "FloorScene")).toBe(true);
  expect(await isSceneActive(page, "PickupModalScene")).toBe(false);
  log = await getEventLog(page);
  expect(log).toHaveLength(2);

  save = await getCtxSave(page);
  expect(save.character.currency).toBe(25); // 15 (goblin drop) + 10 (gold pile)
  expect(save.character.currentHp).toBeGreaterThan(0);
  expect(save.character.currentHp).toBeLessThan(30); // took hazard (and possibly combat) damage
});
