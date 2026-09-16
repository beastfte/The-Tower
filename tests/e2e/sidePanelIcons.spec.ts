import { test, expect } from "@playwright/test";
import type { PlayerSave } from "../../src/domain/character/save";
import { seedSave, waitForActiveScene } from "./helpers";

/** 009: the side panel now shows items as icons (with native-tooltip descriptions) instead of
 * text, and collapses duplicate loot items / keys into one icon with a quantity badge. */
test.describe("Side panel icons", () => {
  test("equipped weapon/armor, gold, loot, and keys render as icons with hover descriptions", async ({ page }) => {
    const save: PlayerSave = {
      character: {
        baseStats: { damage: 5, defence: 2, hp: 30 },
        currentHp: 30,
        inventory: ["loot-torch", "loot-torch", "loot-unbaked"],
        keyIds: ["bronze"],
        currency: 42,
        equippedWeaponId: "sword",
        equippedArmorTier: "leather",
      },
      currentFloorId: "floor-01",
      currentFloorState: {
        floorId: "floor-01",
        playerPosition: { x: 0, y: 10 },
        defeatedEnemyIds: [],
        collectedItemIds: [],
        toggledLeverIds: [],
        openedDoorIds: [],
      },
      completedFloorIds: [],
      completedFloorStates: {},
      hasWon: false,
      isDead: false,
    };
    await seedSave(page, save);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter"); // Continue
    await waitForActiveScene(page, "FloorScene");

    const rows = page.locator('[data-testid="side-panel-rows"]');

    // Weapon icon (real art — sword.svg — always exists for every WeaponId).
    const weaponImg = rows.locator('img[src="/icons/sword.svg"]');
    await expect(weaponImg).toHaveCount(1);
    await expect(weaponImg.locator("xpath=..")).toHaveAttribute("title", /Sword/);

    // Armor icon.
    const armorImg = rows.locator('img[src="/icons/player-leather.svg"]');
    await expect(armorImg).toHaveCount(1);
    await expect(armorImg.locator("xpath=..")).toHaveAttribute("title", /Leather Armor/);

    // Gold: coin icon with the amount as a bottom-right badge (same style as item badges,
    // but always visible — 2026-09-16 clarification, unlike item badges' ≥2 threshold).
    const goldImg = rows.locator('img[src="/icons/coin.svg"]');
    await expect(goldImg).toHaveCount(1);
    const goldWrapper = goldImg.locator("xpath=..");
    await expect(goldWrapper).toHaveAttribute("title", /42 gold/i);
    await expect(goldWrapper.locator("span")).toHaveText("42");

    // Loot: two "loot-torch" collapse into one icon with a "2" badge; the distinct
    // "loot-unbaked" id (no baked art) falls back to a colored swatch with no badge.
    const torchImg = rows.locator('img[src="/icons/torch.svg"]');
    await expect(torchImg).toHaveCount(1);
    const torchWrapper = torchImg.locator("xpath=..");
    await expect(torchWrapper).toHaveAttribute("title", /torch/i);
    await expect(torchWrapper.locator("span")).toHaveText("2");

    // "loot-unbaked" has no baked icon — falls back to a plain colored swatch (no <img>) but
    // still gets its own icon-wrapper element with a tooltip and no quantity badge (count 1).
    const unbakedWrapper = rows.locator('[title^="loot-unbaked"]');
    await expect(unbakedWrapper).toHaveCount(1);
    await expect(unbakedWrapper.locator("img")).toHaveCount(0);
    await expect(unbakedWrapper.locator("span")).toHaveCount(0);

    // Key: single bronze key renders as its icon with a tooltip, and no quantity badge.
    const keyImg = rows.locator('img[src="/icons/key-bronze.svg"]');
    await expect(keyImg).toHaveCount(1);
    const keyWrapper = keyImg.locator("xpath=..");
    await expect(keyWrapper).toHaveAttribute("title", /bronze key/i);
    await expect(keyWrapper.locator("span")).toHaveCount(0);
  });

  test("unarmed/unarmored state still shows the existing text placeholder, not an icon", async ({ page }) => {
    const save: PlayerSave = {
      character: {
        baseStats: { damage: 5, defence: 2, hp: 30 },
        currentHp: 30,
        inventory: [],
        keyIds: [],
        currency: 0,
      },
      currentFloorId: "floor-01",
      currentFloorState: {
        floorId: "floor-01",
        playerPosition: { x: 0, y: 10 },
        defeatedEnemyIds: [],
        collectedItemIds: [],
        toggledLeverIds: [],
        openedDoorIds: [],
      },
      completedFloorIds: [],
      completedFloorStates: {},
      hasWon: false,
      isDead: false,
    };
    await seedSave(page, save);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    const rows = page.locator('[data-testid="side-panel-rows"]');
    await expect(rows).toContainText("Weapon: (unarmed)");
    await expect(rows).toContainText("Armor: (none)");
    await expect(rows).toContainText("(none)"); // Items:/Keys: empty state

    // Gold badge stays visible even at 0 — unlike an item badge, which would be hidden below 2.
    const goldWrapper = rows.locator('img[src="/icons/coin.svg"]').locator("xpath=..");
    await expect(goldWrapper.locator("span")).toHaveText("0");
  });
});
