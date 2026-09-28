import { test, expect } from "@playwright/test";
import type { PlayerSave } from "../../src/domain/character/save";
import { seedSave, waitForActiveScene } from "./helpers";

/** 009: the side panel now shows items as icons (with native-tooltip descriptions) instead of
 * text, and collapses duplicate loot items / keys into one icon with a quantity badge.
 * 018: icons are generated data: URLs (spriteDataUrl), not static /icons/*.svg paths — every
 * assertion here locates by the wrapper's title rather than a fixed src string. */
test.describe("Side panel icons", () => {
  test("equipped weapon/armor, gold, loot, and keys render as icons with hover descriptions", async ({ page }) => {
    const save: PlayerSave = {
      character: {
        baseStats: { damage: 5, defence: 2, hp: 30 },
        currentHp: 30,
        inventory: ["loot-test-a", "loot-test-a", "loot-unbaked"],
        keyIds: ["bronze"],
        currency: 42,
        equippedWeaponId: "sword",
        equippedArmor: { chest: "leather" },
        bonusDamage: 0,
      },
      currentFloorId: "floor-01",
      currentFloorState: {
        floorId: "floor-01",
        playerPosition: { x: 0, y: 7 },
        defeatedEnemyIds: [],
        collectedItemIds: [],
        toggledLeverIds: [],
        openedDoorIds: [],
        crackedWallHitCounts: {},
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

    // Weapon icon (real art — every WeaponId has one).
    const weaponWrapper = rows.locator('div[title^="Sword:"]');
    await expect(weaponWrapper.locator('img[src^="data:"]')).toHaveCount(1);

    // Equipment: a single grouped icon grid (011 FR-013), one icon per slot; only Chest is
    // equipped (Leather), the other 3 slots render as empty placeholders.
    await expect(rows).toContainText("Equipment:");
    const armorWrapper = rows.locator('div[title^="Leather Chest:"]');
    await expect(armorWrapper.locator('img[src^="data:"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Helm: (none)"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Legs: (none)"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Boots: (none)"]')).toHaveCount(1);

    // Gold: coin icon with the amount as a bottom-right badge (same style as item badges,
    // but always visible — 2026-09-16 clarification, unlike item badges' ≥2 threshold).
    const goldWrapper = rows.locator('div[title*="42 gold"]');
    await expect(goldWrapper.locator('img[src^="data:"]')).toHaveCount(1);
    await expect(goldWrapper.locator("span")).toHaveText("42");

    // Loot: no loot id has baked art (LOOT_TEXTURE_KEYS is empty), so both ids fall back to a
    // colored swatch (no <img>). Two "loot-test-a" still collapse into one swatch with a "2"
    // badge; the distinct "loot-unbaked" id gets its own swatch with no badge (count 1).
    const testAWrapper = rows.locator('[title^="loot-test-a"]');
    await expect(testAWrapper).toHaveCount(1);
    await expect(testAWrapper.locator("img")).toHaveCount(0);
    await expect(testAWrapper.locator("span")).toHaveText("2");

    const unbakedWrapper = rows.locator('[title^="loot-unbaked"]');
    await expect(unbakedWrapper).toHaveCount(1);
    await expect(unbakedWrapper.locator("img")).toHaveCount(0);
    await expect(unbakedWrapper.locator("span")).toHaveCount(0);

    // Key: single bronze key renders as its icon with a tooltip, and no quantity badge.
    const keyWrapper = rows.locator('div[title*="bronze key"]');
    await expect(keyWrapper.locator('img[src^="data:"]')).toHaveCount(1);
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
        equippedArmor: {},
        bonusDamage: 0,
      },
      currentFloorId: "floor-01",
      currentFloorState: {
        floorId: "floor-01",
        playerPosition: { x: 0, y: 7 },
        defeatedEnemyIds: [],
        collectedItemIds: [],
        toggledLeverIds: [],
        openedDoorIds: [],
        crackedWallHitCounts: {},
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
    await expect(rows).toContainText("Equipment:");
    await expect(rows.locator('[title^="Helm: (none)"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Chest: (none)"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Legs: (none)"]')).toHaveCount(1);
    await expect(rows.locator('[title^="Boots: (none)"]')).toHaveCount(1);
    await expect(rows).toContainText("(none)"); // Items:/Keys: empty state

    // Gold badge stays visible even at 0 — unlike an item badge, which would be hidden below 2.
    const goldWrapper = rows.locator('div[title*="gold"]');
    await expect(goldWrapper.locator("span")).toHaveText("0");
  });
});
