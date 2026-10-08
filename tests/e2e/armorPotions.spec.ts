import { test, expect } from "@playwright/test";
import { clearSave, collectHealthPotion, waitForActiveScene, pressAndWait, getCtxSave, dismissCombat, startFight } from "./helpers";

/** 011 US1 / 033 FR-015a: collecting a per-slot armor pickup on floor-01 puts it in the bag (it is
 * not worn automatically); wearing it with Equip raises defence by that slot's exact value. */
test("collecting a leather armor piece puts it in the bag; equipping it raises defence", async ({ page }) => {
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
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7), safe
  await pressAndWait(page, "ArrowUp"); // (5,7) -> (5,6), bronze key (022 US1: logged only, no modal)
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), opens the bronze door
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), gold pile
  await pressAndWait(page, "ArrowRight"); // (7,7) -> (8,7)
  await pressAndWait(page, "ArrowRight"); // (8,7) -> (9,7)
  await pressAndWait(page, "ArrowUp"); // (9,7) -> (9,6)
  await pressAndWait(page, "ArrowUp"); // (9,6) -> (9,5)
  await pressAndWait(page, "ArrowUp"); // (9,5) -> (9,4), leather helm

  let save = await getCtxSave(page);
  // 033 FR-015a: the helm waits in the bag, unworn, and defence is unchanged.
  expect(save.character.equippedArmor.helm).toBeUndefined();
  expect(save.character.bagGear).toEqual(["leather:helm"]);
  await expect(page.locator('[data-testid="stat-def"]')).toHaveText(String(baseDefence));
  await expect(page.locator('[data-testid="slot-helm-name"]')).toHaveText("Empty");
  await expect(page.locator('[data-testid="bag-count"]')).toHaveText("1 / 25");

  // Wearing it: select the bag cell, Equip.
  await page.locator('[data-testid="bag-cell-0"]').click();
  await page.locator('[data-testid="bag-equip"]').click();
  save = await getCtxSave(page);
  expect(save.character.equippedArmor.helm).toBe("leather");
  expect(save.character.bagGear).toEqual([]);
  expect(save.character.baseStats.defence).toBe(baseDefence); // baseStats itself is unchanged...
  await expect(page.locator('[data-testid="stat-def"]')).toHaveText(String(baseDefence + 3)); // ...the +3 is effective
  await expect(page.locator('[data-testid="slot-helm-name"]')).toHaveText("Leather Helm");
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
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowDown"); // (1,9) -> (1,10), rat gone
  await pressAndWait(page, "ArrowUp"); // (1,10) -> (1,9)
  await pressAndWait(page, "ArrowUp"); // (1,9) -> (1,8)
  await pressAndWait(page, "ArrowUp"); // (1,8) -> (1,7), back to the corridor
  await pressAndWait(page, "ArrowRight"); // (1,7) -> (2,7)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,7)
  await waitForActiveScene(page, "CombatOverlay");
  await dismissCombat(page); // 022 US2: combat no longer closes itself
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,7) -> (3,7)
  await pressAndWait(page, "ArrowRight"); // (3,7) -> (4,7), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,7) -> (5,7), safe
  await pressAndWait(page, "ArrowUp"); // (5,7) -> (5,6), bronze key (022 US1: logged only, no modal)
  await pressAndWait(page, "ArrowDown"); // (5,6) -> (5,7)
  await pressAndWait(page, "ArrowRight"); // (5,7) -> (6,7), opens the bronze door
  await pressAndWait(page, "ArrowRight"); // (6,7) -> (7,7), gold pile

  await pressAndWait(page, "ArrowDown"); // (7,7) -> (7,8)
  await pressAndWait(page, "ArrowDown"); // (7,8) -> (7,9)
  await pressAndWait(page, "ArrowDown"); // (7,9) -> (7,10)
  await pressAndWait(page, "ArrowDown"); // (7,10) -> (7,11)
  await pressAndWait(page, "ArrowDown"); // (7,11) -> (7,12), the existing floor01-chest (currency, logged only)

  await pressAndWait(page, "ArrowDown"); // (7,12) -> (7,13)
  await pressAndWait(page, "ArrowRight"); // (7,13) -> (8,13), attack potion (logged only)

  let save = await getCtxSave(page);
  expect(save.character.bonusDamage).toBe(2);
  await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("12");

  await pressAndWait(page, "ArrowRight"); // (8,13) -> (9,13)
  await pressAndWait(page, "ArrowRight"); // (9,13) -> (10,13), defense potion (logged only)

  save = await getCtxSave(page);
  expect(save.character.baseStats.defence).toBe(3); // base 2 + defense potion 1
  await expect(page.locator('[data-testid="stat-def"]')).toHaveText("3");

  await page.reload();
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue
  await waitForActiveScene(page, "FloorScene");

  const afterResume = await getCtxSave(page);
  expect(afterResume.character.bonusDamage).toBe(2);
  expect(afterResume.character.baseStats.defence).toBe(3);
});

/** 027 US6 (contracts C16–C18): health potions are carried, not drunk on pickup. Uses runtime
 * placement (`collectHealthPotion`/`startFight`) rather than hard-coded tower coordinates. */
test("a collected health potion leaves HP unchanged and raises the carried count (C16, C18)", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  const found = await collectHealthPotion(page, { character: { currentHp: 10 } });
  expect(found).toBe(true);

  const save = await getCtxSave(page);
  expect(save.character.currentHp).toBe(10); // not healed on pickup
  expect(save.character.potionCount).toBe(1);
  // 033: the carried potion is a bag entry, with a ×N badge once there is more than one.
  await expect(page.locator('[data-testid="bag-count"]')).toHaveText("1 / 25");
  await expect(page.locator('[data-testid="bag-cell-0"] img[src^="data:"]')).toBeVisible();
});

test("drinking a potion mid-battle heals 25% of max HP and uses one (US6, C17)", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  // Max HP 40, at 20: one potion heals ceil(40 × 25%) = 10. Unhurtable and harmless, so HP only
  // moves because of the potion.
  await startFight(page, {
    character: { baseStats: { damage: 1, defence: 100_000, hp: 40 }, currentHp: 20, bonusDamage: 0, potionCount: 2 },
  });
  const potion = page.locator('[data-testid="combat-potion"]');
  const playerHp = page.locator('[data-testid="combat-player-hp-value"]');
  await expect(potion).toHaveText("Potion ×2");
  await expect(potion).toBeEnabled();
  await expect(playerHp).toHaveText("20");

  await potion.click();
  await expect(playerHp).toHaveText("30");
  await expect(potion).toHaveText("Potion ×1");
  await expect(page.locator('[data-testid="combat-pop"]').filter({ hasText: "+10" })).toBeAttached();

  await potion.click(); // 30 → 40, capped
  await expect(playerHp).toHaveText("40");
  await expect(potion).toHaveText("Potion ×0");
  await expect(potion).toBeDisabled(); // no potions left (and at full HP)

  await page.locator('[data-testid="combat-flee"]').click();
  await waitForActiveScene(page, "FloorScene");
  const after = await getCtxSave(page);
  expect(after.character.potionCount).toBe(0); // drunk potions are not refunded by fleeing
  expect(after.character.currentHp).toBe(40);
});
