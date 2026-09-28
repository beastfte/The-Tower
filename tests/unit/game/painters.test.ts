import { describe, expect, it } from "vitest";
import { paintArmourOverlay, paintClassic, paintHighBit } from "../../../src/game/render/painters";
import { ARMOUR_TIERS, C, PAL, type SpriteGrid } from "../../../src/game/render/spriteData";

const palEntries = Object.entries(PAL).filter(([letter]) => letter !== ".");
const [classicLetterA, classicColorA] = palEntries[0]!;
const [classicLetterB, classicColorB] = palEntries[1]!;
const [hbKeyA, hbColorA] = Object.entries(C)[0]!;
const [hbKeyB, hbColorB] = Object.entries(C)[1]!;

function classicGrid(rows: string[]): SpriteGrid {
  return { w: rows[0]!.length, h: rows.length, rows, hb: false };
}

function highBitGrid(rows: string[], map: Record<string, string | string[]>): SpriteGrid {
  return { w: rows[0]!.length, h: rows.length, rows, hb: true, map };
}

describe("paintClassic", () => {
  it("resolves letters through PAL directly", () => {
    const grid = classicGrid([`${classicLetterA}${classicLetterB}`]);
    expect(paintClassic(grid)).toEqual([[classicColorA, classicColorB]]);
  });

  it("leaves '.' cells transparent", () => {
    const grid = classicGrid([`${classicLetterA}.`]);
    expect(paintClassic(grid)).toEqual([[classicColorA, null]]);
  });

  it("resolves through swap before PAL when a swap is given", () => {
    const grid = classicGrid([classicLetterA!]);
    expect(paintClassic(grid, { [classicLetterA!]: classicLetterB! })).toEqual([[classicColorB]]);
  });

  it("ignores a swap entry for a letter the grid never uses", () => {
    const grid = classicGrid([classicLetterA!]);
    expect(paintClassic(grid, { Z: classicLetterB! })).toEqual([[classicColorA]]);
  });

  it("skips a letter absent from PAL", () => {
    const grid = classicGrid(["Ω"]);
    expect(paintClassic(grid)).toEqual([[null]]);
  });
});

describe("paintHighBit", () => {
  it("resolves a letter through map -> C key", () => {
    const grid = highBitGrid(["a"], { a: hbKeyA! });
    expect(paintHighBit(grid)).toEqual([[hbColorA]]);
  });

  it("resolves a letter through map -> literal #hex without touching C", () => {
    const grid = highBitGrid(["a"], { a: "#123456" });
    expect(paintHighBit(grid)).toEqual([["#123456"]]);
  });

  it("resolves a dither pair by (x + y) & 1 parity", () => {
    const grid = highBitGrid(["aa"], { a: [hbColorA!, hbColorB!] });
    // x=0,y=0 -> parity 0 -> first entry; x=1,y=0 -> parity 1 -> second entry
    expect(paintHighBit(grid)).toEqual([[hbColorA, hbColorB]]);
  });

  it("fills a transparent cell using the fixed right, down, left, up probe order", () => {
    // Target cell (0,1) is empty and orthogonally touches both a right neighbour (1,1)='r' and a
    // down neighbour (0,2)='d' of different colours — right must win per the fixed probe order.
    const grid: SpriteGrid = {
      w: 2,
      h: 3,
      rows: ["..", ".r", "d."],
      hb: true,
      map: { r: hbKeyA!, d: hbKeyB! },
    };
    const painted = paintHighBit(grid);
    expect(painted[1]![0]).toBe(outlineOf(hbColorA!));
  });

  it("does not cascade outlines — the outline pass reads only the resolved buffer", () => {
    // Row: filled, empty(touches filled -> outlined), empty(does not touch filled -> stays null)
    const grid = highBitGrid(["f.."], { f: hbKeyA! });
    const painted = paintHighBit(grid);
    expect(painted[0]![0]).toBe(hbColorA);
    expect(painted[0]![1]).toBe(outlineOf(hbColorA!));
    expect(painted[0]![2]).toBeNull();
  });
});

function outlineOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${Math.round(r * 0.26 + 12)}, ${Math.round(g * 0.2 + 6)}, ${Math.round(b * 0.26 + 16)})`;
}

describe("paintArmourOverlay", () => {
  const grid = classicGrid(["Cc"]);

  it("skips the whole overlay for tier 'none' (no regions)", () => {
    expect(paintArmourOverlay(grid, "none", ARMOUR_TIERS)).toEqual([[null, null]]);
  });

  it("resolves lit (uppercase) and shadow (lowercase) faces for a covered region", () => {
    const painted = paintArmourOverlay(grid, "leather", ARMOUR_TIERS);
    const tier = ARMOUR_TIERS.leather;
    expect(painted).toEqual([[PAL[tier.mid!], PAL[tier.dark!]]]);
  });

  it("skips a region the tier does not cover", () => {
    const helmOnly = classicGrid(["H"]);
    expect(paintArmourOverlay(helmOnly, "leather", ARMOUR_TIERS)).toEqual([[null]]);
  });
});
