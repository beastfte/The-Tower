import type Phaser from "phaser";
import { getUiRoot, px } from "./domOverlay";

export interface VolumeSliderConfig {
  /** DESIGN_WIDTH/DESIGN_HEIGHT-space coordinates (see gameConfig.ts), same convention as
   * MenuOptionConfig. */
  x: number;
  y: number;
  /** Initial value, 0 (silence) to 1 (full volume) — matches Phaser's own SoundConfig.volume domain. */
  value: number;
  /** DESIGN_WIDTH-space width of the track (defaults to 160). */
  width?: number;
  /** Fired on every drag step (native "input" event), not just on release, for live feedback. */
  onChange: (value: number) => void;
}

/**
 * A labeled-free music volume slider, mirroring MenuOption.ts's contract: real DOM element in the
 * UI overlay, positioned in design-space units, removed on the scene's shutdown event.
 *
 * Built on a native <input type="range"> rather than a canvas-drawn control — the platform already
 * implements press-drag-release tracking, touch, and pointer capture outside the element's bounds,
 * which a custom Phaser-input-driven slider would otherwise have to reimplement (research R6).
 */
export function createVolumeSlider(scene: Phaser.Scene, config: VolumeSliderConfig): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "range";
  input.className = "ui-volume-slider";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(config.value);
  input.style.left = px(config.x);
  input.style.top = px(config.y);
  input.style.width = px(config.width ?? 160);
  input.style.transform = "translate(-50%, -50%)";

  input.addEventListener("input", () => config.onChange(input.valueAsNumber));
  getUiRoot().appendChild(input);

  scene.events.once("shutdown", () => input.remove());

  return input;
}
