import type Phaser from "phaser";
import { getUiRoot, px } from "./domOverlay";

export interface MenuOptionConfig {
  /** DESIGN_WIDTH/DESIGN_HEIGHT-space coordinates (see gameConfig.ts) — the same numbers
   * this game's scenes have always used pre-RENDER_SCALE, e.g. `DESIGN_WIDTH / 2`. */
  x: number;
  y: number;
  label: string;
  /** Phaser keydown event key (e.g. "ENTER", "ESC"), matching `keydown-<KEY>` event names. */
  key: string;
  color?: string;
  /** Font size in DESIGN_WIDTH-space units (defaults to 10, matching the prior canvas-based default). */
  fontSize?: number;
  onActivate: () => void;
}

/**
 * 002 FR-011: a labeled, clickable option that also responds to a given keyboard key, so
 * every menu screen using it is operable via both pointer and keyboard. Renders as a real
 * DOM `<button>` in the UI overlay (see ui/domOverlay.ts) rather than a Phaser Text object,
 * so it stays sharp regardless of canvas scaling (specs/bugs/ui-text-dom-overlay).
 */
export function createMenuOption(scene: Phaser.Scene, config: MenuOptionConfig): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "ui-menu-option";
  button.textContent = config.label;
  button.style.left = px(config.x);
  button.style.top = px(config.y);
  button.style.transform = "translate(-50%, -50%)";
  button.style.color = config.color ?? "#e0c9a6";
  button.style.fontSize = px(config.fontSize ?? 10);

  button.addEventListener("click", () => config.onActivate());
  getUiRoot().appendChild(button);

  scene.input.keyboard!.once(`keydown-${config.key}`, () => config.onActivate());

  scene.events.once("shutdown", () => button.remove());

  return button;
}
