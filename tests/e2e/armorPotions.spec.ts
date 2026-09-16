import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, pressAndWait, getCtxSave } from "./helpers";

/** 011 US1: collecting a per-slot armor pickup on floor-01 raises defence by that slot's exact
 * value and shows up in the side panel's matching slot row. */
test("collecting a cloth armor piece raises defence and shows in the side panel", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const baseline = await getCtxSave(page);
  const baseDefence = baseline.character.baseStats.defence;

  // Entrance (0,10) -> compulsory goblin at (3,10) -> lava at (4,10) -> bronze key at (5,9) ->
  // bronze door at (6,10) -> gold pile at (7,10) -> torch at (8,9) -> up into the top-middle
  // room -> cloth legs at (9,6). Mirrors the critical-path route used by floorPlay.spec.ts /
  // keyedDoorOpen.spec.ts.
  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,10)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,10) -> (5,10)
  await pressAndWait(page, "ArrowUp"); // (5,10) -> (5,9), bronze key
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (5,9) -> (5,10)
  await pressAndWait(page, "ArrowRight"); // (5,10) -> (6,10), opens the bronze door
  await pressAndWait(page, "ArrowRight"); // (6,10) -> (7,10), gold pile
  await pressAndWait(page, "ArrowRight"); // (7,10) -> (8,10)
  await pressAndWait(page, "ArrowUp"); // (8,10) -> (8,9), loot torch (no modal — not key/potion/chest)
  await pressAndWait(page, "ArrowUp"); // (8,9) -> (8,8), into the top-middle room
  await pressAndWait(page, "ArrowUp"); // (8,8) -> (8,7)
  await pressAndWait(page, "ArrowRight"); // (8,7) -> (9,7)
  await pressAndWait(page, "ArrowUp"); // (9,7) -> (9,6), cloth legs

  const save = await getCtxSave(page);
  expect(save.character.equippedArmor.legs).toBe("cloth");
  expect(save.character.baseStats.defence).toBe(baseDefence); // baseStats itself is unchanged...
  // ...the +2 shows up in effective defence via the side panel instead.
  const rows = page.locator('[data-testid="side-panel-rows"]');
  await expect(rows).toContainText("Def: 4");
  const legsImg = rows.locator('img[src="/icons/armor-cloth-legs.svg"]');
  await expect(legsImg).toHaveCount(1);
  await expect(legsImg.locator("xpath=..")).toHaveAttribute("title", /Cloth Legs/);
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

  // Entrance (0,10) -> right into the optional rat at (1,11) -> down into the bottom-left room
  // -> attack potion at (2,13) -> defense potion at (4,17).
  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await page.keyboard.press("ArrowDown"); // engage the optional rat at (1,11)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowDown"); // (1,10) -> (1,11), rat gone
  await pressAndWait(page, "ArrowDown"); // (1,11) -> (1,12)
  await pressAndWait(page, "ArrowRight"); // (1,12) -> (2,12)
  await pressAndWait(page, "ArrowDown"); // (2,12) -> (2,13), attack potion
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  let save = await getCtxSave(page);
  expect(save.character.bonusDamage).toBe(5);
  const rows = page.locator('[data-testid="side-panel-rows"]');
  await expect(rows).toContainText("Dmg: 15");

  await pressAndWait(page, "ArrowDown"); // (2,13) -> (2,14)
  await pressAndWait(page, "ArrowDown"); // (2,14) -> (2,15), the existing floor01-chest (currency)
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");
  await pressAndWait(page, "ArrowDown"); // (2,15) -> (2,16)
  await pressAndWait(page, "ArrowDown"); // (2,16) -> (2,17)
  await pressAndWait(page, "ArrowRight"); // (2,17) -> (3,17)
  await pressAndWait(page, "ArrowRight"); // (3,17) -> (4,17), defense potion
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  save = await getCtxSave(page);
  expect(save.character.baseStats.defence).toBe(4); // base 2 + defense potion 2
  await expect(rows).toContainText("Def: 4");

  await page.reload();
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue
  await waitForActiveScene(page, "FloorScene");

  const afterResume = await getCtxSave(page);
  expect(afterResume.character.bonusDamage).toBe(5);
  expect(afterResume.character.baseStats.defence).toBe(4);
});
