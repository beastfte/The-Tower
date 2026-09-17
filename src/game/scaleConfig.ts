/** How much bigger than the original 360x280 design resolution the game's real canvas
 * backing store is. Phaser's Scale.FIT mode only ever adjusts the canvas's CSS display
 * size, never its underlying pixel buffer (confirmed in ScaleManager's source: `updateScale()`
 * touches only `style.width/height` under FIT, while `canvas.width/height` are set once, at
 * boot, straight from the raw config width/height) — so the only way to give text (and
 * everything else) more real destination pixels to render into, instead of being nearest-
 * neighbor-stretched from a tiny fixed buffer, is to raise the config width/height themselves.
 * Every other absolute (not width/height-derived) pixel constant in the game — tile size,
 * panel row height/padding, font sizes, literal offsets — must scale by the same factor via
 * `scalePx`/`scaleFont` below, or it'll look disproportionately small once GAME_WIDTH/HEIGHT
 * (gameConfig.ts) are multiplied by this. */
export const RENDER_SCALE = 1.5;

/** Scales an absolute design-space pixel value (e.g. a tile size, a padding, an offset) by
 * RENDER_SCALE. Anything already derived from GAME_WIDTH/GAME_HEIGHT (PLAY_AREA and friends
 * in gameConfig.ts) scales automatically and should NOT be passed through this again. */
export function scalePx(value: number): number {
  return value * RENDER_SCALE;
}

/** The original, RENDER_SCALE-independent design resolution. `gameConfig.ts` multiplies
 * these by RENDER_SCALE for the canvas (sprites/tiles); `ui/domOverlay.ts` uses them
 * directly, unscaled, as the DOM/CSS UI overlay's coordinate space — DOM text is rendered
 * natively by the browser, so it never needed RENDER_SCALE's "give the canvas more real
 * pixels" workaround in the first place (see specs/bugs/ui-text-dom-overlay). Kept here
 * rather than in gameConfig.ts, which imports the real `phaser` package, so ui/domOverlay.ts
 * — and its unit tests — don't pull that in solely to reach these four numbers. */
/** 014 FR-006/FR-007: solved by hand, not derived, so the real `PLAY_AREA` (gameConfig.ts,
 * whose own formulas are otherwise unchanged) evaluates to exactly 960x960 — 15 tiles ×
 * `TILE_SIZE` (64) on each axis. Deriving these from `GAME_WIDTH`/`GAME_HEIGHT` instead would
 * force this module to import gameConfig.ts (→ `phaser`), breaking the Phaser-free isolation
 * described above (research.md #2). If `TILE_SIZE`, the grid size, or the panel/log sizes ever
 * change, redo this arithmetic: `DESIGN_WIDTH = (15 * TILE_SIZE) / RENDER_SCALE + DESIGN_SIDE_PANEL_WIDTH`,
 * `DESIGN_HEIGHT = (15 * TILE_SIZE) / RENDER_SCALE + DESIGN_EVENT_LOG_HEIGHT`. */
export const DESIGN_WIDTH = 736;
export const DESIGN_HEIGHT = 704;
export const DESIGN_SIDE_PANEL_WIDTH = 96;
export const DESIGN_EVENT_LOG_HEIGHT = 64;

/** Upper bound on how far Phaser's Scale.FIT can further grow the (now RENDER_SCALE-native)
 * canvas via CSS, as a multiple of GAME_WIDTH/GAME_HEIGHT. Left unchanged at 4 rather than
 * retuned alongside RENDER_SCALE (see text-readability-100pct/fix.md's Deviations from
 * Assessment) — it only bounds how large a monitor can stretch the already-larger native
 * canvas, which needs a visual check to tune rather than an arithmetic guess. (UI text no
 * longer renders inside the canvas at all — see ui/domOverlay.ts and
 * specs/bugs/ui-text-dom-overlay — so this constant now only governs sprite/tile scaling.)
 * Kept in its own module, free of any `phaser` import, so anything importing just this
 * constant doesn't pull in the `phaser` package, which assumes browser globals at module-load
 * time and crashes outside a real browser environment (e.g. under vitest's node environment). */
export const MAX_SCALE = 4;
