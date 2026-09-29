import { describe, expect, it } from "vitest";
import { paintSprite } from "../../../src/game/render/painters";
import type { SpriteGrid } from "../../../src/game/render/spriteData";

function grid(pal: string[], rows: string[], overrides: Partial<SpriteGrid> = {}): SpriteGrid {
  return { w: rows[0] ? rleWidth(rows[0]) : 0, h: rows.length, pal, rows, ...overrides };
}

function rleWidth(row: string): number {
  let w = 0;
  for (const [, count] of row.matchAll(/(\d+)(.)/g)) w += Number(count);
  return w;
}

describe("paintSprite", () => {
  it("resolves a run through pal via the AL alphabet", () => {
    // AL.indexOf("a") === 0, AL.indexOf("b") === 1
    const g = grid(["#111111", "#222222"], ["1a1b"]);
    expect(paintSprite(g)).toEqual([["#111111", "#222222"]]);
  });

  it("expands a run count to that many repeated pixels", () => {
    const g = grid(["#111111"], ["3a"]);
    expect(paintSprite(g)).toEqual([["#111111", "#111111", "#111111"]]);
  });

  it("leaves '.' runs transparent", () => {
    const g = grid(["#111111"], ["1a2."]);
    expect(paintSprite(g)).toEqual([["#111111", null, null]]);
  });

  it("resolves uppercase letters as distinct AL indices from lowercase", () => {
    // AL.indexOf("A") === 26
    const pal = Array.from({ length: 27 }, (_, i) => `#${i.toString(16).padStart(6, "0")}`);
    const g = grid(pal, ["1A"]);
    expect(paintSprite(g)).toEqual([[pal[26]]]);
  });

  it("every row expands to exactly w pixels (RLE round-trip)", () => {
    const g = grid(["#111111", "#222222"], ["2a1b3.", "1b5."]);
    const painted = paintSprite(g);
    expect(painted[0]).toHaveLength(6);
    expect(painted[1]).toHaveLength(6);
  });

  it("throws on a letter with no entry in this sprite's own pal", () => {
    const g = grid(["#111111"], ["1z"]);
    expect(() => paintSprite(g)).toThrow(/no entry in pal/);
  });

  it("uses each sprite's own pal, not a shared/global one", () => {
    const gridA = grid(["#111111"], ["1a"]);
    const gridB = grid(["#999999"], ["1a"]);
    expect(paintSprite(gridA)).toEqual([["#111111"]]);
    expect(paintSprite(gridB)).toEqual([["#999999"]]);
  });
});
