import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene } from "./helpers";

/** 032 C7: a new game's side panel shows the four live-battle stats. */
test("a new game shows attack speed, crit, crit damage and dodge on the side panel", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const rows = page.locator('[data-testid="side-panel-rows"]');
  await expect(rows).toContainText("Spd: 1.00/s");
  await expect(rows).toContainText("Crit: 5%");
  await expect(rows).toContainText("Crit Dmg: 150%");
  await expect(rows).toContainText("Dodge: 5%");
});
