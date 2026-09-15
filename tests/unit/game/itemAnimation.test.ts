import { describe, expect, it } from "vitest";
import { ANIMATION_AMPLITUDE_PX, computeBobOffset, computeItemPhase } from "../../../src/game/itemAnimation";

describe("computeBobOffset", () => {
  it("stays within the animation amplitude at any time/phase", () => {
    for (let time = 0; time < 5000; time += 137) {
      const offset = computeBobOffset(time, computeItemPhase({ x: 3, y: 4 }));
      expect(Math.abs(offset)).toBeLessThanOrEqual(ANIMATION_AMPLITUDE_PX + 1e-9);
    }
  });

  it("is periodic — repeats after one full period", () => {
    const phase = computeItemPhase({ x: 1, y: 2 });
    const a = computeBobOffset(200, phase);
    const b = computeBobOffset(200 + 1500, phase);
    expect(b).toBeCloseTo(a, 9);
  });
});

describe("computeItemPhase", () => {
  it("differs for items at different grid positions", () => {
    expect(computeItemPhase({ x: 0, y: 0 })).not.toBe(computeItemPhase({ x: 1, y: 0 }));
    expect(computeItemPhase({ x: 0, y: 0 })).not.toBe(computeItemPhase({ x: 0, y: 1 }));
  });
});
