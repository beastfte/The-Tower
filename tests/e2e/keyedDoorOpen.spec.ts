import { test, expect } from "@playwright/test";
import { clearSave, waitForActiveScene, pressAndWait } from "./helpers";

/** 010 US1/US2: opening a keyed door consumes its key and permanently marks it open; an open
 * door then renders with no marker at all, while still-locked doors keep showing theirs. */
test("opening the bronze door on floor-01 consumes the key and makes the door disappear", async ({ page }) => {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");

  const countDoorMarkers = () =>
    page.evaluate(() => {
      const win = window as unknown as {
        __game: {
          scene: {
            getScene: (k: string) => {
              children: { list: { type: string; list?: { texture?: { key: string } }[] }[] };
            };
          };
        };
      };
      const scene = win.__game.scene.getScene("FloorScene");
      const tileLayer = scene.children.list.find((c) => c.type === "Container");
      const doorKeys = new Set(["door-closed", "door-closed-silver", "door-closed-gold"]);
      return (tileLayer?.list ?? []).filter((c) => c.texture && doorKeys.has(c.texture.key)).length;
    });

  // floor-01 has 3 keyed doors (bronze, silver, gold), all still locked at the start.
  expect(await countDoorMarkers()).toBe(3);

  // Walk the real critical path to the bronze key/door: entrance (0,10) -> goblin at (3,10) ->
  // key at (5,9) -> door at (6,10). Mirrors tests/e2e/floorPlay.spec.ts's route.
  await pressAndWait(page, "ArrowRight"); // (0,10) -> (1,10)
  await pressAndWait(page, "ArrowRight"); // (1,10) -> (2,10)
  await page.keyboard.press("ArrowRight"); // engage the compulsory goblin at (3,10)
  await waitForActiveScene(page, "CombatOverlay");
  await waitForActiveScene(page, "FloorScene", 10_000);

  await pressAndWait(page, "ArrowRight"); // (2,10) -> (3,10)
  await pressAndWait(page, "ArrowRight"); // (3,10) -> (4,10), lava entry damage
  await pressAndWait(page, "ArrowRight"); // (4,10) -> (5,10)

  await page.keyboard.press("ArrowUp"); // (5,10) -> (5,9), the bronze key
  await waitForActiveScene(page, "PickupModalScene");
  await page.keyboard.press("Enter");
  await waitForActiveScene(page, "FloorScene");

  let save = await page.evaluate(() => {
    const win = window as unknown as { __game: { registry: { get: (k: string) => { save: { character: { keyIds: string[] } } } } } };
    return win.__game.registry.get("ctx").save;
  });
  expect(save.character.keyIds).toContain("bronze");

  // Holding a matching key must not make the door disappear on its own — it only opens once
  // the player actually walks into it (regression guard for the pickup-triggered vanish bug).
  expect(await countDoorMarkers()).toBe(3);

  await pressAndWait(page, "ArrowDown"); // (5,9) -> (5,10)
  await pressAndWait(page, "ArrowRight"); // (5,10) -> (6,10): opens the bronze door, consumes the key

  save = await page.evaluate(() => {
    const win = window as unknown as { __game: { registry: { get: (k: string) => { save: { character: { keyIds: string[] } } } } } };
    return win.__game.registry.get("ctx").save;
  });
  expect(save.character.keyIds).not.toContain("bronze");

  // Two doors (silver, gold) remain locked and rendered; the now-open bronze door renders nothing.
  expect(await countDoorMarkers()).toBe(2);

  // Walking back over the opened door doesn't re-lock it or consume another key.
  await pressAndWait(page, "ArrowLeft"); // (6,10) -> (5,10)
  await pressAndWait(page, "ArrowRight"); // (5,10) -> (6,10) again
  expect(await countDoorMarkers()).toBe(2);
});
