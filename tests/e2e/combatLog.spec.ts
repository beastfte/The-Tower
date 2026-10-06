import { test, expect } from "@playwright/test";
import { clearSave, getCtxSave, getEventLog, isSceneActive, OVERWHELMING, readSave, startFight, waitForActiveScene } from "./helpers";

/** Can't hurt anything and dies to the first hit (FR-001: the fight is still allowed). */
const DOOMED = { baseStats: { damage: 0, defence: 0, hp: 30 }, currentHp: 1, bonusDamage: 0 };

/**
 * 027 combat modal e2e (contracts C9–C15). Fights are started with `startFight`, which reads the
 * current floor at runtime instead of hard-coding the live tower's layout.
 */

test.beforeEach(async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
});

const modal = (page: import("@playwright/test").Page) => page.locator('[data-testid="combat-modal"]');
const outcome = (page: import("@playwright/test").Page) => page.locator('[data-testid="combat-outcome"]');
const cont = (page: import("@playwright/test").Page) => page.locator('[data-testid="combat-continue"]');

test("victory: live modal, no keyboard, Continue closes it, one log line (US1, C10, C12, C14, C19)", async ({ page }) => {
  const { name } = await startFight(page, { character: OVERWHELMING });

  await expect(modal(page)).toBeVisible();
  await expect(page.getByText(new RegExp(`^Floor \\d+ · ${name}$`))).toBeVisible();
  for (const id of ["combat-player-hp", "combat-monster-hp", "combat-player-bar", "combat-monster-bar"]) {
    await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
  }
  // C12: no keyboard binding at all — keys during the fight do nothing.
  for (const key of ["Space", "Enter", "Escape"]) await page.keyboard.press(key);
  expect(await isSceneActive(page, "CombatOverlay")).toBe(true);

  await expect(outcome(page)).toContainText("Victory", { timeout: 15_000 });
  await expect(outcome(page)).toContainText(`The ${name} falls.`);

  // C12/FR-052: keys don't dismiss the outcome either; only Continue does.
  for (const key of ["Space", "Enter", "Escape"]) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  expect(await isSceneActive(page, "CombatOverlay")).toBe(true);

  await cont(page).click();
  await waitForActiveScene(page, "FloorScene");

  const combatLines = (await getEventLog(page)).filter((e) => e.kind === "combat");
  expect(combatLines).toHaveLength(1);
  expect(combatLines[0]!.message).toMatch(new RegExp(`^You won against ${name}`));
});

test("defeat: no retry, saved before Continue, death screen names the killer (US2, C14, C15)", async ({ page }) => {
  const { name } = await startFight(page, { character: DOOMED, strongestEnemy: true });

  await expect(outcome(page)).toContainText(`Slain by ${name}`, { timeout: 15_000 });
  await expect(outcome(page).getByRole("button")).toHaveCount(1); // Continue only — no retry
  await expect(cont(page)).toBeVisible();

  // FR-029: the death is already saved while the panel is up.
  const saved = await readSave(page);
  expect(saved?.isDead).toBe(true);
  expect(saved?.deathCause).toBe(name);
  const combatLines = (await getEventLog(page)).filter((e) => e.kind === "combat");
  expect(combatLines.map((e) => e.message)).toEqual([`You were slain by ${name}.`]);

  await cont(page).click();
  await waitForActiveScene(page, "DeathScreenScene");
  await expect(page.locator('[data-testid="death-cause"]')).toHaveText(`Slain by ${name}`);

  // C15: the existing checkpoint option behaves exactly as for a trap death — floor entrance,
  // full HP, death state and cause cleared.
  await page.getByRole("button", { name: /Resume from last checkpoint/ }).click();
  await waitForActiveScene(page, "FloorScene");
  const restarted = await readSave(page);
  expect(restarted?.isDead).toBe(false);
  expect(restarted?.deathCause).toBeUndefined();
  expect(restarted?.character.currentHp).toBe(restarted?.character.baseStats.hp);
});

test("defeat: reloading before Continue still lands on the death screen (US2 AS5, C14)", async ({ page }) => {
  const { name } = await startFight(page, { character: DOOMED, strongestEnemy: true });
  await expect(cont(page)).toBeVisible({ timeout: 15_000 });

  // Relaunch in a fresh tab: this page's beforeEach clearSave init-script would wipe the save on
  // reload, which is a test artifact rather than what a player relaunching would see.
  const relaunched = await page.context().newPage();
  await relaunched.goto("/");
  await waitForActiveScene(relaunched, "DeathScreenScene", 15_000);
  await expect(relaunched.locator('[data-testid="death-cause"]')).toHaveText(`Slain by ${name}`);
});

/** A fight that lasts: the player can't be hurt and only chips the monster. */
const SPARRING = { baseStats: { damage: 1, defence: 100_000, hp: 30 }, currentHp: 30, bonusDamage: 0 };

test("crits: every hit shows the large red number at 100%, none at 0% (US3, C11)", async ({ page }) => {
  // Every attack rolls rng() < critChance (5%): forcing rng to 0 makes every hit a crit.
  await page.evaluate(() => (Math.random = () => 0));
  await startFight(page, { character: SPARRING });
  const pops = page.locator('[data-testid="combat-pop"]');
  await expect(pops.first()).toBeAttached({ timeout: 5_000 });
  await page.waitForTimeout(1_200);
  const crit = await pops.evaluateAll((els) =>
    els.map((el) => ({
      crit: (el as HTMLElement).dataset.crit,
      color: getComputedStyle(el.firstElementChild as Element).color,
      size: parseFloat(getComputedStyle(el.firstElementChild as Element).fontSize),
    })),
  );
  expect(crit.length).toBeGreaterThan(0);
  expect(crit.every((p) => p.crit === "true" && p.color === "rgb(255, 59, 59)")).toBe(true);

  await page.evaluate(() => (Math.random = () => 0.99));
  await page.waitForTimeout(2_500);
  const normal = await pops.evaluateAll((els) =>
    els
      .filter((el) => !(el as HTMLElement).dataset.crit)
      .map((el) => parseFloat(getComputedStyle(el.firstElementChild as Element).fontSize)),
  );
  expect(normal.length).toBeGreaterThan(0);
  expect(Math.max(...normal)).toBeLessThan(Math.min(...crit.map((p) => p.size)));
});

test("flee: closes at once, keeps HP as it stood in the fight, monster back at full (US4, C13, FR-021)", async ({ page }) => {
  // Takes real hits (defence 0) but can't kill quickly (damage 1), with plenty of HP to survive.
  const { name, press } = await startFight(page, {
    character: { baseStats: { damage: 1, defence: 0, hp: 500 }, currentHp: 500, bonusDamage: 0 },
  });
  const monsterHp = page.locator('[data-testid="combat-monster-hp-value"]');
  const monsterMax = await monsterHp.textContent();
  const playerHp = page.locator('[data-testid="combat-player-hp-value"]');
  await expect(playerHp).not.toHaveText("500", { timeout: 10_000 }); // the monster landed a hit

  // Read the HP shown at the moment of fleeing, then flee in the same tick.
  const before = structuredClone(await getCtxSave(page));
  const hpAtFlee = await page.evaluate(() => {
    const value = document.querySelector('[data-testid="combat-player-hp-value"]')!.textContent!;
    (document.querySelector('[data-testid="combat-flee"]') as HTMLButtonElement).click();
    return Number(value);
  });
  await waitForActiveScene(page, "FloorScene");
  expect(await isSceneActive(page, "CombatOverlay")).toBe(false);

  const after = await readSave(page);
  expect(after!.character.currentHp).toBe(hpAtFlee); // not the pre-battle 500, not refunded
  expect(after!.character.currentHp).toBeLessThan(500);
  expect(after!.currentFloorState.playerPosition).toEqual(before!.currentFloorState.playerPosition);
  expect(after!.currentFloorState.defeatedEnemyIds).toEqual(before!.currentFloorState.defeatedEnemyIds);

  const combatLines = (await getEventLog(page)).filter((e) => e.kind === "combat");
  expect(combatLines.map((e) => e.message)).toEqual([`You engaged ${name}, it was too powerful and you fled.`]);

  // FR-022/FR-023: the player can move straight away, and re-engaging finds the monster at full HP.
  await page.waitForTimeout(300);
  await page.keyboard.press(press);
  await waitForActiveScene(page, "CombatOverlay");
  await expect(monsterHp).toHaveText(monsterMax!);
});
