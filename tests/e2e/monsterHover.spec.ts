import { test, expect, type Page } from "@playwright/test";
import { clearSave, waitForActiveScene } from "./helpers";

/** 038 US4: hovering a floor monster shows the stats card. Asserts structure only — the numbers
 * come from the live tower, which unit tests deliberately do not depend on. */

async function newGame(page: Page): Promise<void> {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");
}

/** Page-pixel centre of the first living monster marker on the current floor. */
async function firstMonsterCentre(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    type Marker = { gameObject: { getBounds: () => { centerX: number; centerY: number } } };
    const game = (window as unknown as { __game: { canvas: { getBoundingClientRect: () => { left: number; top: number; width: number } }; scale: { width: number }; scene: { getScene: (k: string) => { monsterMarkers: Marker[] } } } }).__game;
    const marker = game.scene.getScene("FloorScene").monsterMarkers[0];
    if (!marker) throw new Error("no living marker on this floor");
    const b = marker.gameObject.getBounds();
    const rect = game.canvas.getBoundingClientRect();
    const k = rect.width / game.scale.width;
    return { x: rect.left + b.centerX * k, y: rect.top + b.centerY * k };
  });
}

test("hovering a monster shows HP, DMG, DEF, ATK SPD and SURVIVE, and leaving hides it", async ({ page }) => {
  await newGame(page);
  const at = await firstMonsterCentre(page);
  await page.mouse.move(at.x - 200, at.y);
  await page.mouse.move(at.x, at.y);

  const tip = page.locator('[data-testid="item-tooltip"]');
  await expect(tip).toBeVisible();
  const labels = await tip.locator('[data-testid="tooltip-line"]').evaluateAll((rows) => rows.map((r) => r.children[0]?.textContent));
  expect(labels).toEqual(["HP", "DMG", "DEF", "ATK SPD", "SURVIVE"]);
  await expect(tip.locator('[data-testid="tooltip-name"]')).not.toHaveText("");
  await expect(tip.locator('[data-testid="tooltip-threat"]')).toHaveText(/^(Trivial|Safe|Risky|Dangerous|Deadly)$/i);
  // 041 C4: no empty icon box and no blank hint row on a monster card
  await expect(tip.locator("img")).toHaveCount(0);
  await expect(tip.locator('[data-testid="tooltip-hint"]')).toHaveCount(0);

  await page.mouse.move(1, 1); // off the canvas, so no other monster is under the pointer
  await expect(tip).toBeHidden();
});
