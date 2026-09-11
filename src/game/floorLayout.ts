import type { ScreenRegion } from "./gameConfig";

/**
 * Fits an arbitrarily-sized floor grid entirely within `area` (e.g. PLAY_AREA), instead of
 * drawing at a fixed tile size regardless of the grid's dimensions. Without this, a grid
 * larger than the reserved play area (e.g. the 20x20 baseline vs. a smaller PLAY_AREA)
 * silently overflows into whatever renders next to it (the side panel, the event log).
 * `Math.floor` keeps the result a whole pixel so tile edges stay crisp.
 */
export function computeTileSize(cols: number, rows: number, area: ScreenRegion): number {
  return Math.floor(Math.min(area.width / cols, area.height / rows));
}

/**
 * Centers the fitted grid within `area` on whichever axis has leftover space (fitting to the
 * tighter of the two width/height ratios in computeTileSize leaves slack on the other axis),
 * rather than pinning the grid to area's top-left corner and leaving all the slack on one side.
 */
export function computeTileLayerOrigin(
  cols: number,
  rows: number,
  tileSize: number,
  area: ScreenRegion,
): { x: number; y: number } {
  return {
    x: area.x + (area.width - cols * tileSize) / 2,
    y: area.y + (area.height - rows * tileSize) / 2,
  };
}
