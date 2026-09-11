import { describe, expect, it } from "vitest";
import { isLowHp } from "../../../src/game/sidePanel/hpState";

describe("isLowHp", () => {
  it("is false well above the threshold", () => {
    expect(isLowHp(30, 30)).toBe(false);
    expect(isLowHp(15, 30)).toBe(false);
  });

  it("is true exactly at the threshold", () => {
    expect(isLowHp(9, 30)).toBe(true);
  });

  it("is true below the threshold, including at 0 HP", () => {
    expect(isLowHp(5, 30)).toBe(true);
    expect(isLowHp(0, 30)).toBe(true);
  });

  it("treats a non-positive max HP as low", () => {
    expect(isLowHp(0, 0)).toBe(true);
  });
});
