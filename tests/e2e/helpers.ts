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

/** 027 (contract C12/C14): combat is live and keyboard-free — wait for the outcome panel, then
 * click Continue. Replaces 022's "press Enter (twice)" dismissal, which no longer does anything. */
export async function dismissCombat(page: Page, timeoutMs = 30_000): Promise<void> {
  const cont = page.locator('[data-testid="combat-continue"]');
  await cont.waitFor({ state: "visible", timeout: timeoutMs });
  await cont.click();
}

export interface FightSetup {
  /** Overrides applied to the fresh character before the fight (e.g. huge damage to force a win). */
  character?: Partial<PlayerSave["character"]>;
  /** Pick the monster with the highest authored damage (for reliable defeats). */
  strongestEnemy?: boolean;
}

/**
 * 027: places the player next to a target without hard-coding the live tower's layout (project
 * rule: tests must not depend on tower content, which is replaced wholesale on every redesign).
 * From the main menu, reads the *current* first floor at runtime, picks a target (a living
 * monster, or a health potion lying on the floor) with a safe walkable neighbour, places the
 * player there with any character overrides, and starts FloorScene. Returns the target's name and
 * the key that walks onto it, or null if the current floor has no such target.
 */
export async function approach(
  page: Page,
  target: "enemy" | "healthPotion",
  setup: FightSetup,
): Promise<{ name: string; press: string } | null> {
  await waitForActiveScene(page, "MainMenuScene");
  const plan = await page.evaluate(({ opts, target }) => {
    // Only the shapes this helper reads — the real types live in src/ and pull in Phaser.
    type P = { x: number; y: number };
    type Placed = { position: P };
    type Enemy = Placed & { species: string; stats: { hp: number; damage: number } };
    type Item = Placed & { id: string; kind: string; payload: unknown };
    type Floor = {
      grid: { walkable: boolean }[][];
      exit: P;
      enemies: Enemy[];
      items: Item[];
      merchants?: Placed[];
    } & Record<"keyedDoors" | "hazardTiles" | "spikePits" | "lavaTiles" | "levers" | "waterTiles" | "crackedWalls", Placed[]>;
    type Ctx = {
      currentFloor: Floor;
      save: { character: Record<string, unknown>; currentFloorState: { playerPosition: P } };
      monsterSpeciesCatalog: Map<string, { name: string }>;
    };
    const win = window as unknown as { __game: { registry: { get: (k: string) => Ctx } } };
    const ctx = win.__game.registry.get("ctx");
    const floor = ctx.currentFloor;
    const key = (p: P) => `${p.x},${p.y}`;
    const blocked = new Set<string>();
    const lists = [
      floor.enemies, floor.items, floor.keyedDoors, floor.hazardTiles, floor.spikePits, floor.lavaTiles,
      floor.levers, floor.waterTiles, floor.crackedWalls, floor.merchants ?? [],
    ];
    for (const list of lists) for (const thing of list) blocked.add(key(thing.position));
    blocked.add(key(floor.exit));
    const walkable = (p: P) => floor.grid[p.y]?.[p.x]?.walkable === true && !blocked.has(key(p));
    const dirs: [string, P][] = [
      ["ArrowLeft", { x: 1, y: 0 }], ["ArrowRight", { x: -1, y: 0 }],
      ["ArrowUp", { x: 0, y: 1 }], ["ArrowDown", { x: 0, y: -1 }],
    ];
    const candidates: { position: P; name: string }[] =
      target === "enemy"
        ? [...floor.enemies]
            .sort((a, b) =>
              opts.strongestEnemy ? b.stats.damage - a.stats.damage : a.stats.hp - b.stats.hp,
            )
            .map((enemy) => ({
              position: enemy.position,
              name: ctx.monsterSpeciesCatalog.get(enemy.species)?.name ?? "Unknown creature",
            }))
        : floor.items.filter((i) => i.kind === "potion").map((i) => ({ position: i.position, name: "Health Potion" }));
    if (target === "healthPotion" && candidates.length === 0) {
      // The shipped tower may carry no health potions at all. Drop one into the *in-memory*
      // floor (never the data files) on any open tile, so the pickup rule is still exercised.
      for (let y = 0; y < floor.grid.length && candidates.length === 0; y++) {
        for (let x = 0; x < floor.grid[y]!.length; x++) {
          const spot = { x, y };
          if (!walkable(spot) || !dirs.some(([, o]) => walkable({ x: x + o.x, y: y + o.y }))) continue;
          floor.items.push({ id: "e2e-health-potion", position: spot, kind: "potion", payload: undefined });
          blocked.add(key(spot));
          candidates.push({ position: spot, name: "Health Potion" });
          break;
        }
      }
    }
    for (const candidate of candidates) {
      for (const [press, offset] of dirs) {
        // Stand at target + offset, then press toward the target.
        const stand = { x: candidate.position.x + offset.x, y: candidate.position.y + offset.y };
        if (!walkable(stand)) continue;
        ctx.save.character = { ...ctx.save.character, ...opts.character };
        ctx.save.currentFloorState.playerPosition = stand;
        return { press, name: candidate.name };
      }
    }
    return null;
  }, { opts: setup, target });
  if (!plan) return null;
  // The real New Game path stops the main menu; game.scene.start() alone would leave its DOM up.
  await page.evaluate(() => {
    const win = window as unknown as { __game: { scene: { stop: (k: string) => void } } };
    win.__game.scene.stop("MainMenuScene");
  });
  await startScene(page, "FloorScene");
  await page.waitForTimeout(300);
  return plan;
}

/** Starts a fight with a monster on the current floor (see `approach`). Resolves once
 * CombatOverlay is active; returns the monster name and the key that walks into it (press it
 * again after fleeing to re-engage). */
export async function startFight(page: Page, setup: FightSetup = {}): Promise<{ name: string; press: string }> {
  const plan = await approach(page, "enemy", setup);
  if (!plan) throw new Error("no fightable monster with a safe neighbour on the current floor");
  await page.keyboard.press(plan.press);
  await waitForActiveScene(page, "CombatOverlay");
  return plan;
}

/** Walks the player onto a health potion on the current floor. Returns false if the current
 * floor has none reachable this way (the caller should skip rather than fail). */
export async function collectHealthPotion(page: Page, setup: FightSetup = {}): Promise<boolean> {
  const plan = await approach(page, "healthPotion", setup);
  if (!plan) return false;
  await pressAndWait(page, plan.press);
  return true;
}

/** A character that wins any fight in one hit and can't be hurt. */
export const OVERWHELMING = { baseStats: { damage: 100_000, defence: 100_000, hp: 30 }, currentHp: 30 };

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
