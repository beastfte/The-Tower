import type { ScreenRegion } from "./gameConfig";

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
