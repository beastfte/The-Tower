import { describe, expect, it } from "vitest";
import { computeTileLayerOrigin } from "../../../src/game/floorLayout";
import type { ScreenRegion } from "../../../src/game/gameConfig";

// The real PLAY_AREA at the current RENDER_SCALE (1.5): 540x420 canvas minus a 144-wide
// side panel and a 96-tall event log. Hardcoded here (not imported) since gameConfig.ts
// pulls in the `phaser` package, which crashes outside a browser environment. This no longer
// matches the real app's PLAY_AREA (014 resized it to a fixed 960x960) — kept as an arbitrary
// fixture purely to exercise computeTileLayerOrigin's general "leftover slack" centering case,
// which the real app no longer produces (014 tiles always exactly fill the real PLAY_AREA).
const PLAY_AREA: ScreenRegion = { x: 0, y: 0, width: 396, height: 324 };

describe("computeTileLayerOrigin", () => {
  it("centers leftover space evenly on the axis that doesn't exactly fill the area", () => {
    // An arbitrary tile size (not computed — computeTileSize was removed in 014, research.md
    // #3) chosen only because it doesn't evenly divide the fixture PLAY_AREA above, so this
    // case still exercises the "leftover slack" centering behavior.
    const tileSize = 16;
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
