import { test, expect } from "@playwright/test";
import type { PlayerSave } from "../../src/domain/character/save";
import { TOWER } from "../../src/data/floors";
import { seedSave, waitForActiveScene } from "./helpers";

const firstFloor = TOWER.floors[0]!;

function save(character: Partial<PlayerSave["character"]>): PlayerSave {
  return {
    character: {
      baseStats: { damage: 5, defence: 2, hp: 30 },
      currentHp: 30,
      inventory: [],
      keyIds: [],
      currency: 0,
      equippedArmor: {},
      bonusDamage: 0,
      ...character,
    },
    currentFloorId: firstFloor.id,
    currentFloorState: {
      floorId: firstFloor.id,
      playerPosition: firstFloor.entrance,
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
}

async function continueGame(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("Enter"); // Continue
  await waitForActiveScene(page, "FloorScene");
}

/** 009 / 033 C2: the character sheet shows worn gear, gold, bag stacks and keys as icons. */
test.describe("Side panel icons", () => {
  test("worn gear, gold, bag stacks and keys render as icons with counts", async ({ page }) => {
    await seedSave(
      page,
      save({
        inventory: ["loot-test-a", "loot-test-a", "loot-unbaked"],
        keyIds: ["bronze"],
        currency: 42,
        equippedWeaponId: "sword",
        equippedArmor: { chest: "leather" },
        potionCount: 3,
      }),
    );
    await continueGame(page);

    // Worn weapon and armour: real art, the item name, no native title tooltip.
    await expect(page.locator('[data-testid="slot-weapon"] img[src^="data:"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="slot-weapon-name"]')).toHaveText("Sword");
    await expect(page.locator('[data-testid="slot-chest-name"]')).toHaveText("Leather Chest");
    for (const slot of ["helm", "legs", "boots"]) {
      await expect(page.locator(`[data-testid="slot-${slot}-name"]`)).toHaveText("Empty");
    }
    await expect(page.locator('[data-testid="side-panel"] [title]:not([data-testid="pause-button"])')).toHaveCount(0);

    // Gold: the coin icon and the amount.
    const gold = page.locator('[data-testid="panel-gold"]');
    await expect(gold.locator('img[src^="data:"]')).toHaveCount(1);
    await expect(gold).toHaveText("42");

    // Bag: two "loot-test-a" collapse into one ×2 cell, "loot-unbaked" is its own cell (no badge),
    // then the ×3 potion stack — three entries, three slots.
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("3 / 25");
    const first = page.locator('[data-testid="bag-cell-0"]');
    await expect(first).toContainText("×2");
    await expect(first.locator("img")).toHaveCount(0); // no baked loot art: coloured swatch
    await expect(page.locator('[data-testid="bag-cell-1"]')).not.toContainText("×");
    const potion = page.locator('[data-testid="bag-cell-2"]');
    await expect(potion.locator('img[src^="data:"]')).toHaveCount(1);
    await expect(potion).toContainText("×3");

    // Keys: bronze lit with its count, silver and gold dimmed at zero.
    await expect(page.locator('[data-testid="key-bronze"]')).toContainText("×1");
    await expect(page.locator('[data-testid="key-bronze"]')).toHaveAttribute("data-count", "1");
    await expect(page.locator('[data-testid="key-silver"]')).toHaveAttribute("data-count", "0");
    await expect(page.locator('[data-testid="key-gold"]')).toHaveAttribute("data-count", "0");
    await expect(page.locator('[data-testid="key-total"]')).toHaveText("1 key");
  });

  test("an unarmed, unarmoured character shows Empty slots, an empty bag and dimmed keys", async ({ page }) => {
    await seedSave(page, save({}));
    await continueGame(page);

    for (const slot of ["weapon", "helm", "chest", "legs", "boots"]) {
      await expect(page.locator(`[data-testid="slot-${slot}-name"]`)).toHaveText("Empty");
    }
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("0 / 25");
    await expect(page.locator('[data-testid="key-total"]')).toHaveText("0 keys");
    // Gold stays visible at 0.
    await expect(page.locator('[data-testid="panel-gold"]')).toHaveText("0");
  });
});
