import type { ArmourTierDef, ArmourTierId, SpriteGrid } from "./spriteData";
import { C, PAL } from "./spriteData";

/** Resolved pixel buffer: one entry per grid cell, `null` for transparent. Phaser-free by design
 * so it can be pinned in a plain vitest node environment (research R1's risk area). */
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

function decodeGrid(grid: SpriteGrid): string[][] {
  return grid.rows.map((row) => row.split(""));
}

/** Letter -> swap (if given) -> PAL. A letter absent from PAL is skipped (contract C1). */
export function paintClassic(grid: SpriteGrid, swap?: Record<string, string>): PixelGrid {
  return decodeGrid(grid).map((row) =>
    row.map((ch) => {
      if (ch === ".") return null;
      const resolved = swap?.[ch] ?? ch;
      return PAL[resolved] ?? null;
    }),
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const outlineCache = new Map<string, string>();

/** outline(#rrggbb) = rgb(r*0.26+12, g*0.2+6, b*0.26+16) — computed, never authored (contract C1). */
function outlineColor(base: string): string {
  const cached = outlineCache.get(base);
  if (cached) return cached;
  const [r, g, b] = hexToRgb(base);
  const out = `rgb(${Math.round(r * 0.26 + 12)}, ${Math.round(g * 0.2 + 6)}, ${Math.round(b * 0.26 + 16)})`;
  outlineCache.set(base, out);
  return out;
}

type Resolved = string | readonly string[] | null;

function resolveHighBit(ch: string, map: SpriteGrid["map"]): Resolved {
  if (ch === ".") return null;
  const v = map?.[ch] ?? ch;
  if (Array.isArray(v)) return v;
  const s = v as string;
  if (s.startsWith("#")) return s;
  return C[s] ?? null;
}

/** Two passes: resolve every filled cell, then fill every transparent cell touching one with a
 * computed outline. Neighbour probe order is fixed — right, down, left, up — first hit wins
 * (contract C1); changing it shifts which colour a shared corner takes. `swap` is ignored,
 * matching the sheet. */
export function paintHighBit(grid: SpriteGrid): PixelGrid {
  const chars = decodeGrid(grid);
  const { w: W, h: H } = grid;
  const resolved: Resolved[][] = chars.map((row) => row.map((ch) => resolveHighBit(ch, grid.map)));
  const at = (x: number, y: number): Resolved => (x < 0 || y < 0 || x >= W || y >= H ? null : resolved[y]![x]!);

  const out: PixelGrid = [];
  for (let y = 0; y < H; y++) {
    const outRow: (string | null)[] = [];
    for (let x = 0; x < W; x++) {
      const col = resolved[y]![x]!;
      if (col === null) {
        const nb = at(x + 1, y) ?? at(x, y + 1) ?? at(x - 1, y) ?? at(x, y - 1);
        outRow.push(nb === null ? null : outlineColor(Array.isArray(nb) ? nb[0]! : nb));
        continue;
      }
      outRow.push(Array.isArray(col) ? col[(x + y) & 1]! : col);
    }
    out.push(outRow);
  }
  return out;
}

/** Worn-armour overlay recolour rule (data-model.md ArmourTier). Skips entirely for tiers with no
 * `regions` (i.e. "none") rather than drawing a transparent overlay. */
export function paintArmourOverlay(grid: SpriteGrid, tier: ArmourTierId, tiers: Readonly<Record<ArmourTierId, ArmourTierDef>>): PixelGrid {
  const t = tiers[tier];
  return decodeGrid(grid).map((row) =>
    row.map((ch) => {
      if (ch === "." || !t.regions) return null;
      const region = ch.toUpperCase();
      if (!t.regions.includes(region)) return null;
      const lit = ch === region;
      const key = region === "P" && lit ? t.accent : lit ? t.mid : t.dark;
      return key ? (PAL[key] ?? null) : null;
    }),
  );
}
