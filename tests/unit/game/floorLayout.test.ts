import { describe, expect, it } from "vitest";
import { computeTileSize, computeTileLayerOrigin } from "../../../src/game/floorLayout";
import type { ScreenRegion } from "../../../src/game/gameConfig";

// The real PLAY_AREA at the current RENDER_SCALE (1.5): 540x420 canvas minus a 144-wide
// side panel and a 96-tall event log. Hardcoded here (not imported) since gameConfig.ts
// pulls in the `phaser` package, which crashes outside a browser environment.
const PLAY_AREA: ScreenRegion = { x: 0, y: 0, width: 396, height: 324 };

describe("computeTileSize", () => {
  it("fits the 20x20 baseline grid entirely within the real PLAY_AREA", () => {
    const tileSize = computeTileSize(20, 20, PLAY_AREA);
    expect(20 * tileSize).toBeLessThanOrEqual(PLAY_AREA.width);
    expect(20 * tileSize).toBeLessThanOrEqual(PLAY_AREA.height);
  });

  it("fits a larger, non-square grid within an arbitrary area", () => {
    const area: ScreenRegion = { x: 0, y: 0, width: 300, height: 200 };
    const cols = 40;
    const rows = 25;
    const tileSize = computeTileSize(cols, rows, area);
    expect(cols * tileSize).toBeLessThanOrEqual(area.width);
    expect(rows * tileSize).toBeLessThanOrEqual(area.height);
  });

  it("fits a grid smaller than the area without leaving it oversized", () => {
    const area: ScreenRegion = { x: 0, y: 0, width: 300, height: 300 };
    const tileSize = computeTileSize(5, 5, area);
    expect(5 * tileSize).toBeLessThanOrEqual(area.width);
    expect(5 * tileSize).toBeLessThanOrEqual(area.height);
  });

  it("returns a whole-pixel size", () => {
    const tileSize = computeTileSize(20, 20, PLAY_AREA);
    expect(Number.isInteger(tileSize)).toBe(true);
  });
});

describe("computeTileLayerOrigin", () => {
  it("centers leftover space evenly on the axis that doesn't exactly fill the area", () => {
    const tileSize = computeTileSize(20, 20, PLAY_AREA);
    const origin = computeTileLayerOrigin(20, 20, tileSize, PLAY_AREA);

    const usedWidth = 20 * tileSize;
    const usedHeight = 20 * tileSize;
    expect(origin.x).toBeCloseTo(PLAY_AREA.x + (PLAY_AREA.width - usedWidth) / 2);
    expect(origin.y).toBeCloseTo(PLAY_AREA.y + (PLAY_AREA.height - usedHeight) / 2);

    // The grid must never extend past the area on either axis.
    expect(origin.x).toBeGreaterThanOrEqual(PLAY_AREA.x);
    expect(origin.y).toBeGreaterThanOrEqual(PLAY_AREA.y);
    expect(origin.x + usedWidth).toBeLessThanOrEqual(PLAY_AREA.x + PLAY_AREA.width);
    expect(origin.y + usedHeight).toBeLessThanOrEqual(PLAY_AREA.y + PLAY_AREA.height);
  });

  it("returns the area's own origin when the grid exactly fills it", () => {
    const area: ScreenRegion = { x: 10, y: 20, width: 100, height: 100 };
    const origin = computeTileLayerOrigin(10, 10, 10, area);
    expect(origin).toEqual({ x: 10, y: 20 });
  });
});
