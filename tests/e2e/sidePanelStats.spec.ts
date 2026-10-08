import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene } from "./helpers";

/** 032 C7 / 033 C2: a new game's character sheet shows the six live stats as tiles. */
test("a new game shows damage, defence, attack speed, crit, crit damage and dodge on the side panel", async ({
  page,
}) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("10");
  await expect(page.locator('[data-testid="stat-def"]')).toHaveText("2");
  await expect(page.locator('[data-testid="stat-spd"]')).toHaveText("1.00/s");
  await expect(page.locator('[data-testid="stat-crit"]')).toHaveText("5%");
  await expect(page.locator('[data-testid="stat-critdmg"]')).toHaveText("150%");
  await expect(page.locator('[data-testid="stat-dodge"]')).toHaveText("5%");
});
