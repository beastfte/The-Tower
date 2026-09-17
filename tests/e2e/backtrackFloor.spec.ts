import { test, expect } from "@playwright/test";
import { TOWER } from "../../src/data/floors";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import type { PlayerSave } from "../../src/domain/character/save";
import { seedSave, waitForActiveScene, getCtxSave, pressAndWait } from "./helpers";

const floor01 = TOWER.floors[0]!;
const floorFinal = TOWER.floors[1]!;

/**
 * Regression coverage for bug fix backtrack-stairs-no-effect (FR-009a/FR-010a): stepping
 * onto a floor's entrance ("stairs down") tile must return the player to the previous
 * floor, restoring its frozen progress (permanently-defeated enemies/collected items stay
 * gone) rather than resetting it.
 */
test.describe("Backtracking to a previous floor", () => {
  test("walking onto the entrance tile returns to the previous floor with its permanence intact", async ({
    page,
  }) => {
    // floor-01 already completed (frozen with a defeated enemy + collected item), now one
    // step past floor-final's entrance so a single ArrowLeft steps back onto it.
    const save: PlayerSave = {
      currentFloorId: floorFinal.id,
      currentFloorState: {
        floorId: floorFinal.id,
        defeatedEnemyIds: [],
        collectedItemIds: [],
        playerPosition: { x: 1, y: 7 },
        toggledLeverIds: [],
        openedDoorIds: [],
        crackedWallHitCounts: {},
      },
      completedFloorIds: [floor01.id],
      completedFloorStates: {
        [floor01.id]: {
          floorId: floor01.id,
          defeatedEnemyIds: ["floor01-goblin"],
          collectedItemIds: ["floor01-key-bronze"],
          playerPosition: floor01.exit,
          toggledLeverIds: [],
          openedDoorIds: ["floor01-door-bronze"],
          crackedWallHitCounts: {},
        },
      },
      character: createInitialPlayerSave(floor01.id, floor01.entrance).character,
      hasWon: false,
      isDead: false,
    };
    await seedSave(page, save);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter"); // Continue
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowLeft"); // (1,7) -> (0,7), floor-final's entrance

    const after = await getCtxSave(page);
    expect(after.currentFloorId).toBe(floor01.id);
    // Permanence (FR-010a): the restored floor keeps its frozen progress, not a fresh one.
    expect(after.currentFloorState.defeatedEnemyIds).toEqual(["floor01-goblin"]);
    expect(after.currentFloorState.collectedItemIds).toEqual(["floor01-key-bronze"]);
    expect(after.currentFloorState.openedDoorIds).toEqual(["floor01-door-bronze"]);
    // Arrives at floor-01's own exit tile — where the player was standing when they
    // originally completed it.
    expect(after.currentFloorState.playerPosition).toEqual(floor01.exit);
    // Bookkeeping (completedFloorIds/completedFloorStates) is untouched by backtracking.
    expect(after.completedFloorIds).toEqual([floor01.id]);
  });

  test("walking onto the entrance tile on the very first floor does nothing (no previous floor)", async ({
    page,
  }) => {
    const save: PlayerSave = {
      ...createInitialPlayerSave(floor01.id, floor01.entrance),
      currentFloorState: {
        ...createInitialPlayerSave(floor01.id, floor01.entrance).currentFloorState,
        playerPosition: { x: 1, y: 7 },
      },
    };
    await seedSave(page, save);
    await page.goto("/");
    await waitForActiveScene(page, "MainMenuScene");
    await page.keyboard.press("Enter");
    await waitForActiveScene(page, "FloorScene");

    await pressAndWait(page, "ArrowLeft"); // (1,7) -> (0,7), floor-01's entrance

    const after = await getCtxSave(page);
    expect(after.currentFloorId).toBe(floor01.id); // unchanged — nothing to step back to
    expect(after.currentFloorState.playerPosition).toEqual({ x: 0, y: 7 });
  });
});
