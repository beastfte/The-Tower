import Phaser from "phaser";
import {
  MAX_SCALE,
  RENDER_SCALE,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  DESIGN_SIDE_PANEL_WIDTH,
  DESIGN_EVENT_LOG_HEIGHT,
} from "./scaleConfig";

export { DESIGN_WIDTH, DESIGN_HEIGHT };

/** Fixed internal render resolution for the pixel-art style (FR-014), scaled by RENDER_SCALE
 * so the canvas has real pixels for sprites/tiles to render into. Scaled up further by
 * Scale.FIT to fill the viewport. */
export const GAME_WIDTH = DESIGN_WIDTH * RENDER_SCALE;
export const GAME_HEIGHT = DESIGN_HEIGHT * RENDER_SCALE;

/** Side panel (002 FR-001): full height, right-hand side. */
export const SIDE_PANEL_WIDTH = DESIGN_SIDE_PANEL_WIDTH * RENDER_SCALE;

/** Event log (002 FR-016): dedicated strip under the play area, left of the panel. */
export const EVENT_LOG_HEIGHT = DESIGN_EVENT_LOG_HEIGHT * RENDER_SCALE;

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 014 FR-004/FR-005: every floor tile renders at this fixed size — no longer computed per
 * floor (research.md #1). Lives in the same already-`RENDER_SCALE`'d pixel space as
 * `GAME_WIDTH`/`PLAY_AREA` below, not passed through `scalePx()`. */
export const TILE_SIZE = 64;

/** Floor grid / combat display region — never drawn into by the side panel or event log (002 FR-007, FR-016).
 * Sized to exactly fit a 15x15 grid of `TILE_SIZE` tiles (014 FR-006, research.md #2) —
 * `DESIGN_WIDTH`/`DESIGN_HEIGHT` (scaleConfig.ts) are the only values solved for this; every
 * formula below is unchanged from before that feature. */
export const PLAY_AREA: ScreenRegion = {
  x: 0,
  y: 0,
  width: GAME_WIDTH - SIDE_PANEL_WIDTH,
  height: GAME_HEIGHT - EVENT_LOG_HEIGHT,
};

export const EVENT_LOG_AREA: ScreenRegion = {
  x: 0,
  y: GAME_HEIGHT - EVENT_LOG_HEIGHT,
  width: GAME_WIDTH - SIDE_PANEL_WIDTH,
  height: EVENT_LOG_HEIGHT,
};

export const SIDE_PANEL_AREA: ScreenRegion = {
  x: GAME_WIDTH - SIDE_PANEL_WIDTH,
  y: 0,
  width: SIDE_PANEL_WIDTH,
  height: GAME_HEIGHT,
};

/** Design-space (RENDER_SCALE-independent) counterparts of the regions above, used by the
 * DOM/CSS UI overlay (ui/domOverlay.ts) instead of the RENDER_SCALE'd, canvas-only versions. */
export const DESIGN_PLAY_AREA: ScreenRegion = {
  x: 0,
  y: 0,
  width: DESIGN_WIDTH - DESIGN_SIDE_PANEL_WIDTH,
  height: DESIGN_HEIGHT - DESIGN_EVENT_LOG_HEIGHT,
};

export const DESIGN_EVENT_LOG_AREA: ScreenRegion = {
  x: 0,
  y: DESIGN_HEIGHT - DESIGN_EVENT_LOG_HEIGHT,
  width: DESIGN_WIDTH - DESIGN_SIDE_PANEL_WIDTH,
  height: DESIGN_EVENT_LOG_HEIGHT,
};

export const DESIGN_SIDE_PANEL_AREA: ScreenRegion = {
  x: DESIGN_WIDTH - DESIGN_SIDE_PANEL_WIDTH,
  y: 0,
  width: DESIGN_SIDE_PANEL_WIDTH,
  height: DESIGN_HEIGHT,
};

export function createGameConfig(
  parent: string,
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    // 014: was Phaser.AUTO (prefers WebGL). This game uses no WebGL-only feature anywhere
    // (no shaders, custom pipelines, blend modes, or particle emitters — grep confirms it),
    // so Canvas2D renders it identically. Forced explicitly because growing every tile to a
    // fixed, much larger 64px made WebGL's cost scale with the resulting bigger textures —
    // fine on real GPU-accelerated WebGL, but a software WebGL fallback (e.g. SwiftShader,
    // common in sandboxed/CI browsers with no real GPU) got measurably, sometimes severely
    // slower redrawing the full tile layer on every move, occasionally delaying input
    // handling itself. Canvas2D's software rasterizer has no such WebGL-emulation tax.
    type: Phaser.CANVAS,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: "#0a0a0c",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // 002 FR-022 / 014 FR-011: bound how far FIT can grow the canvas (MAX_SCALE) but not
      // how far it can shrink — a fixed minimum forces the canvas to overflow the page
      // (page-level scroll bar) whenever the real browser viewport (window height minus
      // tabs/address bar/etc.) is shorter than that floor, which a 736x704 design resolution
      // routinely is on real desktop browsers at 100% zoom. No `min` lets FIT shrink the
      // whole game (tiles included) to fit whatever viewport it's actually given; the extra
      // backing resolution from RENDER_SCALE keeps it sharp when scaled down.
      max: { width: GAME_WIDTH * MAX_SCALE, height: GAME_HEIGHT * MAX_SCALE },
    },
    scene: scenes,
  };
}
