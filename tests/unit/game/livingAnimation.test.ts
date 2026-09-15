import { describe, expect, it } from "vitest";
import {
  ANIMATION_AMPLITUDE_PX,
  ANIMATION_PERIOD_MS,
  computeBobOffset,
  computePositionPhase,
} from "../../../src/game/livingAnimation";

describe("computeBobOffset", () => {
  it("stays within the animation amplitude at any time/phase", () => {
    for (let time = 0; time < 5000; time += 137) {
      const offset = computeBobOffset(time, computePositionPhase({ x: 3, y: 4 }));
      expect(Math.abs(offset)).toBeLessThanOrEqual(ANIMATION_AMPLITUDE_PX + 1e-9);
    }
  });

  it("is periodic — repeats after one full period", () => {
    const phase = computePositionPhase({ x: 1, y: 2 });
    const a = computeBobOffset(200, phase);
    const b = computeBobOffset(200 + ANIMATION_PERIOD_MS, phase);
    expect(b).toBeCloseTo(a, 9);
  });
});

describe("computePositionPhase", () => {
  it("differs for entities at different grid positions", () => {
    expect(computePositionPhase({ x: 0, y: 0 })).not.toBe(computePositionPhase({ x: 1, y: 0 }));
    expect(computePositionPhase({ x: 0, y: 0 })).not.toBe(computePositionPhase({ x: 0, y: 1 }));
  });
});
