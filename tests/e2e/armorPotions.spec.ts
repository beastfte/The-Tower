import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, pressAndWait, getCtxSave } from "./helpers";

/** 011 US1: collecting a per-slot armor pickup on floor-01 raises defence by that slot's exact
 * value and shows up in the side panel's matching slot row. */
test("collecting a leather armor piece raises defence and shows in the side panel", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const baseline = await getCtxSave(page);
  const baseDefence = baseline.character.baseStats.defence;

  // Entrance (0,7) -> compulsory goblin at (3,7) -> lava at (4,7) -> bronze key at (5,6) ->
  // bronze door at (6,7) -> gold pile at (7,7) -> right into the post-door area -> up into
  // the upper pocket -> leather helm at (9,4) (018: the weakest tier, formerly cloth).
  // Mirrors the critical-path route used by floorPlay.spec.ts / keyedDoorOpen.spec.ts.
  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,7)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7), safe
  await pressAndWait(page, "ArrowUp"); // (5,7) -> (5,6), bronze key
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), opens the bronze door
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), gold pile
  await pressAndWait(page, "ArrowRight"); // (7,7) -> (8,7)
  await pressAndWait(page, "ArrowRight"); // (8,7) -> (9,7)
  await pressAndWait(page, "ArrowUp"); // (9,7) -> (9,6)
  await pressAndWait(page, "ArrowUp"); // (9,6) -> (9,5)
  await pressAndWait(page, "ArrowUp"); // (9,5) -> (9,4), leather helm

  const save = await getCtxSave(page);
  expect(save.character.equippedArmor.helm).toBe("leather");
  expect(save.character.baseStats.defence).toBe(baseDefence); // baseStats itself is unchanged...
  // ...the +3 shows up in effective defence via the side panel instead.
  const rows = page.locator('[data-testid="side-panel-rows"]');
  await expect(rows).toContainText("Def: 5");
  // 018: side panel icons are generated data: URLs (spriteDataUrl), not static /icons/*.svg
  // paths, so this asserts by title rather than by src.
  await expect(rows.locator('div[title*="Leather Helm"]')).toHaveCount(1);
});

/** 011 US3: Attack/Defense potions apply a permanent, immediately-visible bonus and persist
 * across save/resume. */
test("attack and defense potions permanently raise stats and persist across reload", async ({ page }) => {
  // Deliberately not using clearSave here: it clears via page.addInitScript, which re-runs on
  // every navigation including the page.reload() below, wiping the save before "Continue" can
  // read it back (see tests/e2e/quickstartWalkthrough.spec.ts scenario 6's identical note). A
  // fresh Playwright test context already starts with empty localStorage.
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  // Entrance (0,7) -> right into the optional rat at (1,10) -> back to the corridor -> through
  // the compulsory goblin/lava/bronze-key/bronze-door gate -> the existing floor01-chest at
  // (7,12) -> attack potion at (8,13) -> defense potion at (10,13).
  await pressAndWait(page, "ArrowRight"); // (0,7) -> (1,7)
  await pressAndWait(page, "ArrowDown"); // (1,7) -> (1,8)
  await pressAndWait(page, "ArrowDown"); // (1,8) -> (1,9)
  await page.keyboard.press("ArrowDown"); // engage the optional rat at (1,10)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowDown"); // (1,9) -> (1,10), rat gone
  await pressAndWait(page, "ArrowUp"); // (1,10) -> (1,9)
  await pressAndWait(page, "ArrowUp"); // (1,9) -> (1,8)
  await pressAndWait(page, "ArrowUp"); // (1,8) -> (1,7), back to the corridor
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,7)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7), safe
  await pressAndWait(page, "ArrowUp"); // (5,7) -> (5,6), bronze key
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), opens the bronze door
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), gold pile

  await pressAndWait(page, "ArrowDown"); // (7,7) -> (7,8)
  await pressAndWait(page, "ArrowDown"); // (7,8) -> (7,9)
  await pressAndWait(page, "ArrowDown"); // (7,9) -> (7,10)
  await pressAndWait(page, "ArrowDown"); // (7,10) -> (7,11)
  await pressAndWait(page, "ArrowDown"); // (7,11) -> (7,12), the existing floor01-chest (currency)
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  await pressAndWait(page, "ArrowDown"); // (7,12) -> (7,13)
  await pressAndWait(page, "ArrowRight"); // (7,13) -> (8,13), attack potion
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  let save = await getCtxSave(page);
  expect(save.character.bonusDamage).toBe(2);
  const rows = page.locator('[data-testid="side-panel-rows"]');
  await expect(rows).toContainText("Dmg: 12");

  await pressAndWait(page, "ArrowRight"); // (8,13) -> (9,13)
  await pressAndWait(page, "ArrowRight"); // (9,13) -> (10,13), defense potion
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  save = await getCtxSave(page);
  expect(save.character.baseStats.defence).toBe(3); // base 2 + defense potion 1
  await expect(rows).toContainText("Def: 3");

  await page.reload();
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue
  await waitForActiveScene(page, "FloorScene");

  const afterResume = await getCtxSave(page);
  expect(afterResume.character.bonusDamage).toBe(2);
  expect(afterResume.character.baseStats.defence).toBe(3);
});
