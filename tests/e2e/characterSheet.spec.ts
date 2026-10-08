import { test, expect, type Page } from "@playwright/test";
import { approach, clearSave, getCtxSave, getEventLog, pressAndWait, waitForActiveScene } from "./helpers";
import type { GradeId } from "../../src/domain/character/grades";

/** 033: the character sheet, item tooltip, event log and bag. Everything is set up at runtime
 * through the `window.__game` hook, so none of it depends on the live tower's layout. */

async function newGame(page: Page): Promise<void> {
  await clearSave(page);
  await page.goto("/");
  await waitForActiveScene(page, "MainMenuScene");
  await page.keyboard.press("KeyN");
  await waitForActiveScene(page, "FloorScene");
}

/** Runs `fn` against the in-memory character (the panel notices the change on its next frame). */
async function setCharacter(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate((p) => {
    const win = window as unknown as {
      __game: { registry: { get: (k: string) => { save: { character: Record<string, unknown> } } } };
    };
    const ctx = win.__game.registry.get("ctx");
    ctx.save.character = { ...ctx.save.character, ...p };
  }, patch);
  await page.waitForTimeout(150);
}

/** Drops `item` on an open tile next to the player (in memory only) and returns the key that
 * walks onto it and the key that walks back off. */
async function placeItemAhead(
  page: Page,
  item: { id: string; kind: string; payload: unknown },
): Promise<{ onto: string; off: string }> {
  const plan = await page.evaluate((it) => {
    type P = { x: number; y: number };
    type Ctx = {
      currentFloor: { grid: { walkable: boolean }[][]; items: { id: string; position: P; kind: string; payload: unknown }[] } & Record<string, { position: P }[]>;
      save: { currentFloorState: { playerPosition: P } };
    };
    const win = window as unknown as { __game: { registry: { get: (k: string) => Ctx } } };
    const ctx = win.__game.registry.get("ctx");
    const floor = ctx.currentFloor;
    const from = ctx.save.currentFloorState.playerPosition;
    const taken = new Set<string>();
    for (const list of Object.values(floor)) {
      if (!Array.isArray(list)) continue;
      for (const thing of list as { position?: P }[]) if (thing?.position) taken.add(`${thing.position.x},${thing.position.y}`);
    }
    const dirs: [string, string, P][] = [
      ["ArrowRight", "ArrowLeft", { x: 1, y: 0 }],
      ["ArrowLeft", "ArrowRight", { x: -1, y: 0 }],
      ["ArrowDown", "ArrowUp", { x: 0, y: 1 }],
      ["ArrowUp", "ArrowDown", { x: 0, y: -1 }],
    ];
    for (const [onto, off, d] of dirs) {
      const spot = { x: from.x + d.x, y: from.y + d.y };
      if (floor.grid[spot.y]?.[spot.x]?.walkable !== true || taken.has(`${spot.x},${spot.y}`)) continue;
      floor.items.push({ id: it.id, position: spot, kind: it.kind, payload: it.payload });
      return { onto, off };
    }
    return null;
  }, item);
  if (!plan) throw new Error("no open tile next to the player");
  return plan;
}

const item = (key: string, grade: GradeId = "common", extras = {}) => ({ key, grade, extras });
const fullBag = (n = 25) => Array.from({ length: n }, () => item("mail:helm"));
const lastLog = async (page: Page) => (await getEventLog(page)).at(-1);

test.describe("US1: character sheet (033)", () => {
  test("a new game shows name, gold, HP, stats, empty slots, an empty bag and dimmed keys", async ({ page }) => {
    await newGame(page);
    await expect(page.locator('[data-testid="panel-name"]')).toHaveText("The Prince");
    await expect(page.locator('[data-testid="panel-gold"]')).toHaveText("0");
    await expect(page.locator('[data-testid="panel-hp-text"]')).toHaveText("30 / 30");
    for (const id of ["stat-dmg", "stat-def", "stat-spd", "stat-crit", "stat-critdmg", "stat-dodge"]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
    for (const slot of ["weapon", "helm", "chest", "legs", "boots"]) {
      await expect(page.locator(`[data-testid="slot-${slot}-name"]`)).toHaveText("Empty");
    }
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("0 / 25");
    for (const id of ["bag-use", "bag-equip", "bag-discard"]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeDisabled();
    }
    for (const tier of ["bronze", "silver", "gold"]) {
      await expect(page.locator(`[data-testid="key-${tier}"]`)).toHaveAttribute("data-count", "0");
    }
    await expect(page.locator('[data-testid="key-total"]')).toHaveText("0 keys");
  });

  test("HP, gold and keys update immediately; the pause button pauses", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { currentHp: 12, currency: 37, keyIds: ["bronze", "bronze", "gold"] });
    await expect(page.locator('[data-testid="panel-hp-text"]')).toHaveText("12 / 30");
    await expect(page.locator('[data-testid="panel-hp-bar"]')).toHaveCSS("width", /.+/);
    const fill = await page.locator('[data-testid="panel-hp-bar"]').evaluate((el) => (el as HTMLElement).style.width);
    expect(fill).toBe("40%");
    await expect(page.locator('[data-testid="panel-gold"]')).toHaveText("37");
    await expect(page.locator('[data-testid="key-bronze"]')).toHaveAttribute("data-count", "2");
    await expect(page.locator('[data-testid="key-gold"]')).toHaveAttribute("data-count", "1");
    await expect(page.locator('[data-testid="key-total"]')).toHaveText("3 keys");

    await page.locator('[data-testid="pause-button"]').click();
    await waitForActiveScene(page, "PauseMenuScene");
  });
});

test.describe("US2: item tooltip (033)", () => {
  test("shows a worn item, a compared bag item, a potion and a key, and hides on leave", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, {
      equippedWeaponId: "sword",
      bagGear: [item("diamondSword")],
      potionCount: 2,
      keyIds: ["bronze"],
    });
    const tip = page.locator('[data-testid="item-tooltip"]');

    // Worn weapon: stats, no comparison, take-off hint.
    await page.locator('[data-testid="slot-weapon"]').hover();
    await expect(tip).toBeVisible();
    await expect(tip.locator('[data-testid="tooltip-name"]')).toHaveText("Sword");
    await expect(tip.locator('[data-testid="tooltip-delta"]')).toHaveCount(0);
    await expect(tip.locator('[data-testid="tooltip-compared"]')).toHaveCount(0);
    await expect(tip.locator('[data-testid="tooltip-hint"]')).toHaveText("Click to take off");

    // Bag cells are: 0 = potion stack, 1 = the spare Diamond Sword.
    const diamondCell = page.locator('[data-testid="bag-cell-1"]');
    await diamondCell.hover();
    await expect(tip.locator('[data-testid="tooltip-name"]')).toHaveText("Diamond Sword");
    await expect(tip.locator('[data-testid="tooltip-compared"]')).toHaveText("Compared with your Sword");
    const delta = tip.locator('[data-testid="tooltip-delta"]').first();
    await expect(delta).toHaveAttribute("data-better", "true");
    await expect(delta).toContainText("▲");

    // The card sits beside its item (never over it) and inside the board.
    const t = (await tip.boundingBox())!;
    const c = (await diamondCell.boundingBox())!;
    const canvas = (await page.locator("canvas").boundingBox())!;
    expect(t.x + t.width).toBeLessThanOrEqual(c.x + 1);
    expect(t.x).toBeGreaterThanOrEqual(canvas.x - 1);
    expect(t.y).toBeGreaterThanOrEqual(canvas.y - 1);
    expect(t.y + t.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);

    // Potion stack and key tile: a description and their own hints.
    await page.locator('[data-testid="bag-cell-0"]').hover();
    await expect(tip.locator('[data-testid="tooltip-name"]')).toHaveText("Health potion");
    await expect(tip.locator('[data-testid="tooltip-hint"]')).toHaveText("Drink during battle");
    await page.locator('[data-testid="key-bronze"]').hover();
    await expect(tip.locator('[data-testid="tooltip-name"]')).toHaveText("Bronze key");
    await page.locator('[data-testid="key-silver"]').hover();
    await expect(tip.locator('[data-testid="tooltip-hint"]')).toHaveText("None held yet");

    // No native browser tooltips remain on the panel (except the pause button's).
    await expect(page.locator('[data-testid="side-panel"] [title]:not([data-testid="pause-button"])')).toHaveCount(0);

    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
  });

  test("appears at once and hides when a fight starts (SC-003, FR-010)", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    const plan = await approach(page, "enemy", {
      character: { equippedWeaponId: "sword", baseStats: { damage: 1, defence: 100_000, hp: 30 }, currentHp: 30 },
    });
    expect(plan).not.toBeNull();

    const elapsed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="slot-weapon"]')!;
      const t0 = performance.now();
      el.dispatchEvent(new MouseEvent("mouseenter"));
      const shown = (document.querySelector('[data-testid="item-tooltip"]') as HTMLElement).style.display === "block";
      return shown ? performance.now() - t0 : -1;
    });
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(100);

    await page.keyboard.press(plan!.press);
    await waitForActiveScene(page, "CombatOverlay");
    await expect(page.locator('[data-testid="item-tooltip"]')).toBeHidden();
  });
});

test.describe("US3: event log (033)", () => {
  test("rows carry the right kind and dot colour, with the newest in bold", async ({ page }) => {
    await newGame(page);
    await expect(page.locator('[data-testid="event-log"]')).toContainText("Event log");
    await page.evaluate(() => {
      const win = window as unknown as { __game: { registry: { get: (k: string) => { eventLog: unknown[] } } } };
      const log = win.__game.registry.get("ctx").eventLog;
      for (const kind of ["combat", "pickup", "purchase", "gear", "note"]) log.push({ kind, message: `row ${kind}` });
    });
    await page.waitForTimeout(200);

    const rows = page.locator('[data-testid="event-log-row"]');
    await expect(rows).toHaveCount(5);
    const dots = await rows.evaluateAll((els) => {
      const probe = (v: string) => {
        const d = document.createElement("div");
        d.style.background = `var(${v})`;
        document.getElementById("ui-root")!.appendChild(d);
        const c = getComputedStyle(d).backgroundColor;
        d.remove();
        return c;
      };
      return els.map((el) => ({
        kind: (el as HTMLElement).dataset.kind,
        dot: getComputedStyle(el.querySelector("span")!).backgroundColor,
        weight: getComputedStyle(el).fontWeight,
        want: {
          combat: probe("--ui-red"),
          pickup: probe("--ui-gold"),
          purchase: probe("--ui-gold"),
          gear: probe("--ui-green"),
          note: probe("--ui-muted"),
        } as Record<string, string>,
      }));
    });
    for (const d of dots) expect(d.dot, d.kind).toBe(d.want[d.kind!]);
    expect(dots.map((d) => d.weight)).toEqual(["400", "400", "400", "400", "700"]);
  });
});

test.describe("US4: bag actions and the 25-slot limit (033)", () => {
  test("a picked-up weapon lands in the bag; Equip wears it and logs the stat change", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { equippedWeaponId: "woodSword" });
    await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("13");

    const { onto } = await placeItemAhead(page, { id: "e2e-diamond-sword", kind: "weapon", payload: "diamondSword" });
    await pressAndWait(page, onto);
    const save = await getCtxSave(page);
    expect(save.character.bagGear).toEqual([item("diamondSword")]);
    expect(save.character.equippedWeaponId).toBe("woodSword"); // not worn automatically
    await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("13");
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("1 / 25");

    await expect(page.locator('[data-testid="bag-equip"]')).toBeDisabled();
    await page.locator('[data-testid="bag-cell-0"]').click();
    await expect(page.locator('[data-testid="bag-equip"]')).toBeEnabled();
    await expect(page.locator('[data-testid="bag-use"]')).toBeDisabled();
    await page.locator('[data-testid="bag-equip"]').click();

    await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("24");
    await expect(page.locator('[data-testid="slot-weapon-name"]')).toHaveText("Diamond Sword");
    expect((await getCtxSave(page)).character.bagGear).toEqual([item("woodSword")]);
    await expect(page.locator('[data-testid="bag-equip"]')).toBeDisabled(); // selection cleared
  });

  test("clicking a worn piece takes it off into the bag", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { equippedWeaponId: "sword" });
    await page.locator('[data-testid="slot-weapon"]').click();
    await expect(page.locator('[data-testid="slot-weapon-name"]')).toHaveText("Empty");
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("1 / 25");
    await expect(page.locator('[data-testid="stat-dmg"]')).toHaveText("10");
  });

  test("Discard removes one unit and logs it; Use is disabled outside battle", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { bagGear: [item("sword"), item("mail:helm")], potionCount: 2 });
    // cells: 0 = potions, 1 = sword, 2 = mail helm
    await page.locator('[data-testid="bag-cell-0"]').click();
    await expect(page.locator('[data-testid="bag-use"]')).toBeDisabled(); // only usable in battle
    await expect(page.locator('[data-testid="bag-discard"]')).toBeEnabled();
    await page.locator('[data-testid="bag-cell-1"]').click(); // select the sword
    await page.locator('[data-testid="bag-discard"]').click();
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("2 / 25");
    expect((await getCtxSave(page)).character.bagGear).toEqual([item("mail:helm")]);
    expect((await lastLog(page))?.message).toBe("Discarded Sword.");
  });

  test("with a full bag, gear stays on the floor, gold still collects, and discarding frees the slot", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { bagGear: fullBag() });
    await expect(page.locator('[data-testid="bag-count"]')).toHaveText("25 / 25 · Full");

    const gear = await placeItemAhead(page, { id: "e2e-blocked-sword", kind: "weapon", payload: "sword" });
    await pressAndWait(page, gear.onto);
    let save = await getCtxSave(page);
    expect(save.character.bagGear).toHaveLength(25);
    expect(save.currentFloorState.collectedItemIds).not.toContain("e2e-blocked-sword");
    expect((await lastLog(page))?.message).toBe("Your bag is full. Sword stays on the floor.");

    // Discard one, step off and back on: now it is picked up.
    await page.locator('[data-testid="bag-cell-0"]').click();
    await page.locator('[data-testid="bag-discard"]').click();
    await pressAndWait(page, gear.off);
    await pressAndWait(page, gear.onto);
    save = await getCtxSave(page);
    expect(save.currentFloorState.collectedItemIds).toContain("e2e-blocked-sword");
    expect(save.character.bagGear).toHaveLength(25);

    // The bag is full again (25). Gold never needs a slot, so it still collects.
    const before = (await getCtxSave(page)).character.currency;
    const gold = await placeItemAhead(page, { id: "e2e-gold", kind: "currency", payload: 9 });
    await pressAndWait(page, gold.onto);
    expect((await getCtxSave(page)).character.currency).toBe(before + 9);
  });

  test("with a full bag, a worn piece cannot be taken off", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, { equippedWeaponId: "sword", bagGear: fullBag() });
    await page.locator('[data-testid="slot-weapon"]').hover();
    await expect(page.locator('[data-testid="tooltip-hint"]')).toHaveText("Bag full · can't take off");
    await page.locator('[data-testid="slot-weapon"]').click();
    await expect(page.locator('[data-testid="slot-weapon-name"]')).toHaveText("Sword");
    expect((await lastLog(page))?.message).toBe("Your bag is full. Sword stays on.");
  });

  test("the sheet is read-only during a fight, but a potion can be used from it", async ({ page }) => {
    await clearSave(page);
    await page.goto("/");
    const plan = await approach(page, "enemy", {
      character: {
        baseStats: { damage: 1, defence: 100_000, hp: 40 },
        currentHp: 20,
        potionCount: 2,
        bagGear: [item("sword")],
      },
    });
    expect(plan).not.toBeNull();
    await page.keyboard.press(plan!.press);
    await waitForActiveScene(page, "CombatOverlay");

    // cells: 0 = potions, 1 = sword. Equip and Discard are locked in battle; Use works.
    await page.locator('[data-testid="bag-cell-1"]').click();
    await expect(page.locator('[data-testid="bag-equip"]')).toBeDisabled();
    await expect(page.locator('[data-testid="bag-discard"]')).toBeDisabled();
    await page.locator('[data-testid="bag-cell-0"]').click();
    await expect(page.locator('[data-testid="bag-use"]')).toBeEnabled();
    await page.locator('[data-testid="bag-use"]').click();
    await expect(page.locator('[data-testid="combat-player-hp-value"]')).toHaveText("30");
    await expect(page.locator('[data-testid="combat-potion"]')).toHaveText("Potion ×1");
  });
});

test.describe("034: grade display", () => {
  test("a graded bag item glows in its grade colour without tinting the cell, and a worn name takes the colour", async ({ page }) => {
    await newGame(page);
    await setCharacter(page, {
      equippedWeaponId: "sword",
      equippedRolls: { weapon: { grade: "legendary", extras: {} } },
      bagGear: [item("mail:helm", "rare", { dodge: 0.03, critChance: 0.04 })],
    });
    const cell = page.locator('[data-testid="bag-cell-0"]');
    // #60a5fa (rare) = rgb(96, 165, 250)
    await expect(cell).toHaveCSS("box-shadow", /rgb\(96, 165, 250\)/);
    await expect(cell).not.toHaveCSS("background-color", "rgb(96, 165, 250)"); // glow only, no tint
    // #fb923c (legendary) = rgb(251, 146, 60)
    await expect(page.locator('[data-testid="slot-weapon-name"]')).toHaveCSS("color", "rgb(251, 146, 60)");
    await expect(page.locator('[data-testid="slot-weapon"]')).toHaveCSS("box-shadow", /rgb\(251, 146, 60\)/);
  });
});
