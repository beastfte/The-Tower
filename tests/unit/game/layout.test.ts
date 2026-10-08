import { describe, expect, it } from "vitest";
import {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  DESIGN_UI_GUTTER,
  DESIGN_SIDE_PANEL_WIDTH,
  DESIGN_EVENT_LOG_HEIGHT,
} from "../../../src/game/scaleConfig";

/** 033 C1 / SC-007: the board's proportions match the mock-up (tower 69% x 75%, panel 27% of the
 * width, log 20% of the height). Computed from scaleConfig alone — gameConfig.ts imports Phaser. */
const TOWER = 640;
const g = DESIGN_UI_GUTTER;
const tower = { x: g, y: g, w: TOWER, h: TOWER };
const log = { x: g, y: g + TOWER + g, w: TOWER, h: DESIGN_EVENT_LOG_HEIGHT };
const panel = { x: g + TOWER + g, y: g, w: DESIGN_SIDE_PANEL_WIDTH, h: DESIGN_HEIGHT - 2 * g };

const overlaps = (a: typeof tower, b: typeof tower) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("board layout (033 C1)", () => {
  it("fits the board exactly: gutter + tower + gutter + panel/log + gutter", () => {
    expect(DESIGN_WIDTH).toBe(g + TOWER + g + DESIGN_SIDE_PANEL_WIDTH + g);
    expect(DESIGN_HEIGHT).toBe(g + TOWER + g + DESIGN_EVENT_LOG_HEIGHT + g);
  });

  it("keeps the tower square at 960 render px (15 tiles x 64)", () => {
    expect(tower.w).toBe(tower.h);
    expect(tower.w * 1.5).toBe(960);
  });

  it("never overlaps the tower, log and panel", () => {
    expect(overlaps(tower, log)).toBe(false);
    expect(overlaps(tower, panel)).toBe(false);
    expect(overlaps(log, panel)).toBe(false);
  });

  it("matches the mock-up shares within 2 percentage points", () => {
    const pp = (value: number, target: number) => Math.abs(value * 100 - target);
    expect(pp(tower.w / DESIGN_WIDTH, 69.1)).toBeLessThan(2);
    expect(pp(tower.h / DESIGN_HEIGHT, 75.5)).toBeLessThan(2);
    expect(pp(panel.w / DESIGN_WIDTH, 26.5)).toBeLessThan(2);
    expect(pp(log.h / DESIGN_HEIGHT, 19.9)).toBeLessThan(2);
  });
});
