import Phaser from "phaser";
import {
  MAX_SCALE,
  RENDER_SCALE,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  DESIGN_SIDE_PANEL_WIDTH,
  DESIGN_EVENT_LOG_HEIGHT,
} from "./scaleConfig";

export { MAX_SCALE, DESIGN_WIDTH, DESIGN_HEIGHT, DESIGN_SIDE_PANEL_WIDTH, DESIGN_EVENT_LOG_HEIGHT };

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

/** Floor grid / combat display region — never drawn into by the side panel or event log (002 FR-007, FR-016).
 * Sized independently of any specific floor's tile dimensions (research.md #6). */
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
    type: Phaser.AUTO,
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
      // 002 FR-022: bound how far FIT can grow/shrink the canvas — a sensible minimum
      // (native resolution) and maximum (MAX_SCALE) rather than scaling without limit.
      min: { width: GAME_WIDTH, height: GAME_HEIGHT },
      max: { width: GAME_WIDTH * MAX_SCALE, height: GAME_HEIGHT * MAX_SCALE },
    },
    scene: scenes,
  };
}
