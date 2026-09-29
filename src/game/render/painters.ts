import type { SpriteGrid } from "./spriteData";

/** Resolved pixel buffer: one entry per grid cell, `null` for transparent. Phaser-free by design
 * so it can be pinned in a plain vitest node environment. */
export type PixelGrid = (string | null)[][];

/** Blits a resolved pixel buffer onto any standard Canvas2D context, one pixel per fillRect —
 * shared by Phaser's canvas textures (spriteTextures.ts) and plain DOM `<canvas>` icons
 * (SidePanelScene), since both expose the same CanvasRenderingContext2D surface. */
export function paintPixelsTo(ctx: CanvasRenderingContext2D, pixels: PixelGrid): void {
  for (let y = 0; y < pixels.length; y++) {
    const row = pixels[y]!;
    for (let x = 0; x < row.length; x++) {
      const color = row[x];
      if (color == null) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const AL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RLE = /(\d+)(.)/g;

/** Run-length decode. Each row is matched as `<count><char>` pairs; `"."` is transparent, any
 * other character resolves to `grid.pal[AL.indexOf(char)]` — this sprite's own palette, never a
 * shared one (contract C1). An out-of-range index is a generation-time failure by construction
 * (the generator validates every sprite before committing it), so this throws rather than
 * falling back silently if it's ever handed bad data. */
export function paintSprite(grid: SpriteGrid): PixelGrid {
  const out: PixelGrid = [];
  for (const row of grid.rows) {
    const pixels: (string | null)[] = [];
    for (const [, count, ch] of row.matchAll(RLE)) {
      if (ch === ".") {
        for (let i = 0; i < Number(count); i++) pixels.push(null);
        continue;
      }
      const color = grid.pal[AL.indexOf(ch!)];
      if (color === undefined) throw new Error(`sprite letter '${ch}' has no entry in pal`);
      for (let i = 0; i < Number(count); i++) pixels.push(color);
    }
    out.push(pixels);
  }
  return out;
}
