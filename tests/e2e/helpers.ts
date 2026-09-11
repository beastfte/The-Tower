import type { Page } from "@playwright/test";
import type { PlayerSave } from "../../src/domain/character/save";

/** Matches src/persistence/localStorageAdapter.ts's SAVE_KEY. */
const SAVE_KEY = "fantasy-tower-adventure:save";

/** Clears any prior save so the app boots as a brand-new player. */
export async function clearSave(page: Page): Promise<void> {
  await page.addInitScript((key) => window.localStorage.removeItem(key), SAVE_KEY);
}

/** Seeds localStorage with a specific save before the app's first script runs. */
export async function seedSave(page: Page, save: PlayerSave): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_KEY, value: JSON.stringify(save) },
  );
}

/** Reads the current localStorage save back out (or null), e.g. to assert it was untouched. */
export async function readSave(page: Page): Promise<PlayerSave | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PlayerSave) : null;
  }, SAVE_KEY);
}

/** True once the named Phaser Scene is active, per the `window.__game` test hook (main.ts). */
export async function isSceneActive(page: Page, sceneKey: string): Promise<boolean> {
  return page.evaluate((key) => {
    const win = window as unknown as { __game?: { scene: { isActive: (k: string) => boolean } } };
    return win.__game?.scene.isActive(key) ?? false;
  }, sceneKey);
}

/** Test-only navigation: starts a named Phaser Scene directly via the `window.__game` hook,
 * bypassing whatever UI path would normally reach it. Needed for scenes (e.g. WinScreenScene)
 * that are no longer reachable from the main menu for every save shape (a won save no longer
 * offers "Continue" — 002 FR-008a) but whose own UI still needs exercising in isolation.
 * Waits for the game to finish booting (its initial scene, e.g. MainMenuScene, to be up) before
 * issuing the transition, so this is safe to call right after `page.goto("/")`. */
export async function startScene(page: Page, sceneKey: string, data?: unknown): Promise<void> {
  await page.waitForFunction(() => {
    const win = window as unknown as { __game?: { scene: { isActive: (k: string) => boolean } } };
    return win.__game !== undefined;
  });
  await page.evaluate(
    ({ key, sceneData }) => {
      const win = window as unknown as { __game?: { scene: { start: (k: string, d?: unknown) => void } } };
      win.__game?.scene.start(key, sceneData);
    },
    { key: sceneKey, sceneData: data },
  );
  await waitForActiveScene(page, sceneKey);
}

export async function waitForActiveScene(page: Page, sceneKey: string, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    (key) => {
      const win = window as unknown as { __game?: { scene: { isActive: (k: string) => boolean } } };
      return win.__game?.scene.isActive(key) ?? false;
    },
    sceneKey,
    { timeout: timeoutMs },
  );
}

/** The current in-memory GameContext.eventLog, via the `window.__game` test hook. */
export async function getEventLog(page: Page): Promise<{ kind: string; message: string }[]> {
  return page.evaluate(() => {
    const win = window as unknown as {
      __game?: { registry: { get: (k: string) => { eventLog: { kind: string; message: string }[] } } };
    };
    return win.__game?.registry.get("ctx").eventLog ?? [];
  });
}

/** The current PlayerSave held on GameContext (may be ahead of localStorage before a persist()). */
export async function getCtxSave(page: Page): Promise<PlayerSave> {
  return page.evaluate(() => {
    const win = window as unknown as { __game?: { registry: { get: (k: string) => { save: PlayerSave } } } };
    return win.__game!.registry.get("ctx").save;
  });
}

/** Presses a key and waits long enough for FloorScene's MOVE_COOLDOWN_MS (160ms) to clear. */
export async function pressAndWait(page: Page, key: string, ms = 250): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(ms);
}

// Deliberately not imported from src/game/gameConfig.ts: that module (and anything else under
// src/game/) pulls in the `phaser` package, which assumes browser globals (HTMLVideoElement,
// etc.) at module-load time and crashes when evaluated in Playwright's Node-side test runner.
//
// Intentionally left at the original 360x280 design size, NOT gameConfig.ts's actual (RENDER_SCALE-
// multiplied) GAME_WIDTH/GAME_HEIGHT: gameToPage() below only uses these as ratio denominators
// (gx/GAME_WIDTH), and every call site passes coordinates in this same original 360x280 space
// (e.g. 180 for a horizontal center). Since RENDER_SCALE scales the whole game uniformly, that
// ratio is scale-invariant — changing these without also rescaling every call site would break it.
const GAME_WIDTH = 360;
const GAME_HEIGHT = 280;

/** Converts fixed 360x280 game-space coordinates (as used throughout src/game/scenes, before
 * gameConfig.ts's RENDER_SCALE multiplier) to real page pixel coordinates, accounting for
 * Phaser's Scale.FIT CSS scaling of the canvas. */
export async function gameToPage(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("canvas not found");
  return {
    x: box.x + (gx / GAME_WIDTH) * box.width,
    y: box.y + (gy / GAME_HEIGHT) * box.height,
  };
}
