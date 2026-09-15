import { test, expect } from "@playwright/test";
import type { PlayerSave } from "../../src/domain/character/save";
import { isSceneActive, seedSave, waitForActiveScene } from "./helpers";

/**
 * specs/bugs/ui-text-dom-overlay: UI text now renders as real DOM elements in `#ui-root`,
 * positioned over the canvas rather than baked into it (see src/game/ui/domOverlay.ts).
 * This is the regression guard for that overlay staying aligned with the canvas — the
 * property the whole fix depends on — across the FIT resizes that its own `resize`
 * listener (not just a one-time boot calculation) is responsible for catching.
 */
test.describe("DOM UI overlay", () => {
  test("#ui-root's box matches the canvas's box, initially and after a resize", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    const boxesMatch = async () => {
      const canvasBox = await page.locator("canvas").boundingBox();
      const uiRootBox = await page.locator("#ui-root").boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(uiRootBox).not.toBeNull();
      expect(uiRootBox!.x).toBeCloseTo(canvasBox!.x, 0);
      expect(uiRootBox!.y).toBeCloseTo(canvasBox!.y, 0);
      expect(uiRootBox!.width).toBeCloseTo(canvasBox!.width, 0);
      expect(uiRootBox!.height).toBeCloseTo(canvasBox!.height, 0);
    };

    await boxesMatch();

    await page.setViewportSize({ width: 1600, height: 950 });
    await page.waitForTimeout(300);
    await boxesMatch();
  });

  test("main menu title renders as real DOM text, not a canvas-only Phaser Text object", async ({ page }) => {
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");

    await expect(page.locator("#ui-root")).toContainText("The Tower");
  });

  test("side panel and event log render as DOM text with the expected test hooks", async ({ page }) => {
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("KeyN");
    await waitForActiveScene(page, "FloorScene");

    await expect(page.locator('[data-testid="side-panel-rows"]')).toContainText("Player");
    await expect(page.locator('[data-testid="event-log-text"]')).toContainText("no events yet");
  });

  test("side panel and event log DOM text is torn down (not left overlapping) once the player dies", async ({
    page,
  }) => {
    // Unlike the old canvas-only rendering, SidePanelScene/EventLogScene's DOM text sits in
    // #ui-root above the whole canvas regardless of Phaser scene depth — DeathScreenScene's
    // own dim overlay (still drawn on the canvas) can no longer visually hide it. FloorScene
    // must stop both scenes explicitly before handing off, or their text lingers on top of
    // (and overlapping) the death/win screen's own text.
    const deadlyHazardSave: PlayerSave = {
      character: {
        baseStats: { damage: 5, defence: 2, hp: 30 },
        currentHp: 1,
        inventory: [],
        keyIds: [],
        currency: 0,
      },
      currentFloorId: "floor-01",
      currentFloorState: {
        floorId: "floor-01",
        playerPosition: { x: 3, y: 10 }, // one tile short of floor01-lava at (4, 10)
        defeatedEnemyIds: ["floor01-goblin"],
        collectedItemIds: [],
      },
      completedFloorIds: [],
      completedFloorStates: {},
      hasWon: false,
      isDead: false,
    };
    await seedSave(page, deadlyHazardSave);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter"); // Continue
    await waitForActiveScene(page, "FloorScene");

    await expect(page.locator('[data-testid="side-panel-rows"]')).toBeAttached();
    await expect(page.locator('[data-testid="event-log-text"]')).toBeAttached();

    await page.keyboard.press("ArrowRight"); // steps onto the hazard tile; HP 1 -> dies
    await waitForActiveScene(page, "DeathScreenScene");

    await expect(page.locator('[data-testid="side-panel-rows"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="event-log-text"]')).toHaveCount(0);
    expect(await isSceneActive(page, "SidePanelScene")).toBe(false);
    expect(await isSceneActive(page, "EventLogScene")).toBe(false);
  });
});
