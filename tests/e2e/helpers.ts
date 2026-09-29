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

/** 022 US2 (contract C6/C7): CombatOverlay never closes itself — it always waits for a key
 * press. If the log hasn't finished revealing yet, the first press only reveals it instantly
 * (contract C6); a second press is then needed to actually close the encounter. Pressing twice
 * unconditionally is always safe: once revealed, a further press just closes it sooner. */
export async function dismissCombat(page: Page): Promise<void> {
  await page.keyboard.press("Enter");
  if (!(await isSceneActive(page, "FloorScene"))) {
    await page.keyboard.press("Enter");
  }
}

/** Presses a key and waits long enough for FloorScene's MOVE_COOLDOWN_MS (160ms) to clear.
 * 014 grew every floor tile to a fixed, much larger 64px, and initially made this flaky under
 * this sandbox's software-WebGL fallback (SwiftShader) — full-tile-layer redraws scaled with
 * the bigger textures, occasionally delaying a keydown past the old 250ms default. Root-caused
 * to the renderer, not the wait: `gameConfig.ts` now forces `Phaser.CANVAS` (the game uses no
 * WebGL-only feature anywhere), which resolved it outright — confirmed reliable at the original
 * 250ms across repeated runs once that landed. A polling alternative (wait for `FloorScene`'s
 * own `canMove` to cycle false→true instead of a flat sleep) was tried and measured *less*
 * reliable than this plain sleep, not more — likely extra overhead from firing many sequential
 * `waitForFunction` polls back-to-back — so this stays a fixed sleep. */
export async function pressAndWait(page: Page, key: string, ms = 250): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(ms);
}

// Deliberately not imported from src/game/gameConfig.ts: that module (and anything else under
// src/game/) pulls in the `phaser` package, which assumes browser globals (HTMLVideoElement,
// etc.) at module-load time and crashes when evaluated in Playwright's Node-side test runner.
//
// Kept in sync with scaleConfig.ts's DESIGN_WIDTH/DESIGN_HEIGHT (736x704 since 014 grew the
// design size to fit the fixed 15x15/64px floor baseline — was 360x280), NOT gameConfig.ts's
// actual (RENDER_SCALE-multiplied) GAME_WIDTH/GAME_HEIGHT: gameToPage() below only uses these
// as ratio denominators (gx/GAME_WIDTH), and every call site passes coordinates in this same
// design-space (e.g. a horizontal center in DESIGN_WIDTH units). Since RENDER_SCALE scales the
// whole game uniformly, that ratio is scale-invariant — changing these without also rescaling
// every call site would break it.
const GAME_WIDTH = 736;
const GAME_HEIGHT = 704;

/** Converts fixed design-space coordinates (DESIGN_WIDTH/DESIGN_HEIGHT units, as used
 * throughout src/game/scenes, before gameConfig.ts's RENDER_SCALE multiplier) to real page
 * pixel coordinates, accounting for Phaser's Scale.FIT CSS scaling of the canvas. */
export async function gameToPage(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("canvas not found");
  return {
    x: box.x + (gx / GAME_WIDTH) * box.width,
    y: box.y + (gy / GAME_HEIGHT) * box.height,
  };
}
