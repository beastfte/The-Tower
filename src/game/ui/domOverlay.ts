import type Phaser from "phaser";
import { DESIGN_WIDTH } from "../scaleConfig";

const UI_ROOT_ID = "ui-root";

/**
 * The DOM/CSS overlay that all UI text renders into, positioned over the Phaser canvas.
 * Exists to sidestep a structural limitation of rendering text inside the canvas: because
 * the game is `pixelArt: true` / `antialias: false`, Phaser sets `image-rendering: pixelated`
 * on the whole canvas element (correct for sprites/tiles), which nearest-neighbor-magnifies
 * the ENTIRE fixed-resolution backing store — including any Text glyphs baked into it — up to
 * however large Scale.FIT displays it. No per-Text-object resolution/filter setting can reach
 * past that canvas-wide CSS rule (see specs/bugs/ui-text-dom-overlay/assessment.md). Real DOM
 * text isn't subject to it at all, so it stays sharp at any zoom or devicePixelRatio.
 */
export function getUiRoot(): HTMLDivElement {
  const el = document.getElementById(UI_ROOT_ID);
  if (!el) {
    throw new Error(`#${UI_ROOT_ID} not found — expected a static element in index.html`);
  }
  return el as HTMLDivElement;
}

/**
 * Keeps `#ui-root`'s CSS box aligned with the canvas's live bounding rect (Scale.FIT can
 * letterbox/pillarbox the canvas within its parent, so `#ui-root` can't just fill the parent)
 * and sets `--px`, a CSS custom property holding how many real CSS pixels one DESIGN_WIDTH-space
 * unit currently occupies on screen. Every UI element's position/size is expressed as
 * `calc(var(--px) * N)` (see `px()` below) so it automatically tracks Scale.FIT resizes and any
 * devicePixelRatio, with no further JS recomputation needed per element.
 */
export function syncUiRootToCanvas(game: Phaser.Game): void {
  const root = getUiRoot();

  const sync = () => {
    const rect = game.canvas.getBoundingClientRect();
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
    // Must carry a "px" unit: `calc(var(--px) * 264)` only produces a valid CSS <length>
    // if var(--px) itself resolves to a length (e.g. `1.5px`) rather than a bare number —
    // `calc()` with two unitless numbers yields a unitless number, which every length
    // property (left/top/width/font-size/...) below silently rejects, falling back to its
    // initial value (`auto`) with no console warning.
    root.style.setProperty("--px", `${rect.width / DESIGN_WIDTH}px`);
  };

  sync();
  game.scale.on("resize", sync);
}

/** A CSS `calc()` expression for `designUnits` DESIGN_WIDTH-space units, in real CSS pixels. */
export function px(designUnits: number): string {
  return `calc(var(--px) * ${designUnits})`;
}

export interface UiTextOptions {
  /** DESIGN_WIDTH/DESIGN_HEIGHT-space anchor point. */
  x: number;
  y: number;
  /** Fraction of the element's own box that sits at (x, y) on each axis — mirrors Phaser
   * Text's `setOrigin(originX, originY)` (0.5 = centered, the default here on both axes). */
  originX?: number;
  originY?: number;
  /** Font size in DESIGN_WIDTH-space units. */
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  /** Wraps text within this many DESIGN_WIDTH-space units (mirrors Phaser Text's `wordWrap`). */
  maxWidth?: number;
}

/** Creates a positioned DOM text node inside `#ui-root`, mirroring how this codebase's
 * scenes previously built Phaser `Text` objects (anchor point + origin fractions + font
 * size, all in DESIGN_WIDTH-space units). Callers own the returned element's lifecycle
 * (append to a scene-specific container, update via `.textContent`, remove on shutdown). */
export function createUiText(text: string, opts: UiTextOptions): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "ui-text";
  div.textContent = text;
  div.style.left = px(opts.x);
  div.style.top = px(opts.y);
  const originX = opts.originX ?? 0.5;
  const originY = opts.originY ?? 0.5;
  div.style.transform = `translate(${-originX * 100}%, ${-originY * 100}%)`;
  div.style.fontSize = px(opts.fontSize ?? 10);
  div.style.color = opts.color ?? "#e0c9a6";
  div.style.textAlign = opts.align ?? "left";
  if (opts.maxWidth !== undefined) {
    div.style.width = px(opts.maxWidth);
  }
  return div;
}
