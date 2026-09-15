import { describe, expect, it } from "vitest";
import {
  computeLavaFrame,
  computeSpikePitSegment,
  isSpikePitArmed,
  LAVA_BASE_MS,
  LAVA_GLOW_MS,
  SPIKE_ARMED_MS,
  SPIKE_FALLING_MS,
  SPIKE_RETRACTED_MS,
  SPIKE_RISING_MS,
} from "../../../src/game/trapAnimation";
import { computePositionPhase } from "../../../src/game/livingAnimation";

const pitAt = (x: number, y: number) => ({ id: "p", position: { x, y }, damage: 5 });

describe("computeSpikePitSegment / isSpikePitArmed", () => {
  const pit = { id: "p0", position: { x: 0, y: 0 }, damage: 5 };
  const phase = computePositionPhase(pit.position); // 0 for (0,0)

  it("is retracted at the start of the cycle and not armed", () => {
    expect(computeSpikePitSegment(pit, 0 - phase)).toBe("retracted");
    expect(isSpikePitArmed(pit, 0 - phase)).toBe(false);
  });

  it("is rising (still safe) right after the retracted window", () => {
    const t = SPIKE_RETRACTED_MS + 1 - phase;
    expect(computeSpikePitSegment(pit, t)).toBe("rising");
    expect(isSpikePitArmed(pit, t)).toBe(false);
  });

  it("is armed partway through the armed window", () => {
    const t = SPIKE_RETRACTED_MS + SPIKE_RISING_MS + Math.floor(SPIKE_ARMED_MS / 2) - phase;
    expect(computeSpikePitSegment(pit, t)).toBe("armed");
    expect(isSpikePitArmed(pit, t)).toBe(true);
  });

  it("is falling (no longer armed) right after the armed window", () => {
    const t = SPIKE_RETRACTED_MS + SPIKE_RISING_MS + SPIKE_ARMED_MS + 1 - phase;
    expect(computeSpikePitSegment(pit, t)).toBe("falling");
    expect(isSpikePitArmed(pit, t)).toBe(false);
  });

  it("wraps back to retracted after a full cycle", () => {
    const total = SPIKE_RETRACTED_MS + SPIKE_RISING_MS + SPIKE_ARMED_MS + SPIKE_FALLING_MS;
    expect(computeSpikePitSegment(pit, total - phase)).toBe("retracted");
  });

  it("gives independently-phased tiles different states at the same instant", () => {
    const a = pitAt(0, 0);
    const b = pitAt(5, 7);
    const t = SPIKE_RETRACTED_MS + SPIKE_RISING_MS + 10;
    // Different phases at the same elapsed time can land in different segments.
    expect(computePositionPhase(a.position)).not.toBe(computePositionPhase(b.position));
    expect(typeof computeSpikePitSegment(a, t)).toBe("string");
    expect(typeof computeSpikePitSegment(b, t)).toBe("string");
  });
});

describe("computeLavaFrame", () => {
  const lava = { id: "l0", position: { x: 0, y: 0 }, damage: 8 };
  const phase = computePositionPhase(lava.position); // 0 for (0,0)

  it("is the base frame at the start of the cycle", () => {
    expect(computeLavaFrame(lava, 0 - phase)).toBe("lava");
  });

  it("switches to the glow frame after the base hold", () => {
    expect(computeLavaFrame(lava, LAVA_BASE_MS + 1 - phase)).toBe("lava-glow");
  });

  it("wraps back to the base frame after a full cycle", () => {
    const total = LAVA_BASE_MS + LAVA_GLOW_MS;
    expect(computeLavaFrame(lava, total - phase)).toBe("lava");
  });

  it("gives independently-phased tiles potentially different frames at the same instant", () => {
    const a = { id: "a", position: { x: 0, y: 0 }, damage: 8 };
    const b = { id: "b", position: { x: 5, y: 7 }, damage: 8 };
    expect(computePositionPhase(a.position)).not.toBe(computePositionPhase(b.position));
    expect(["lava", "lava-glow"]).toContain(computeLavaFrame(a, LAVA_BASE_MS + 10));
    expect(["lava", "lava-glow"]).toContain(computeLavaFrame(b, LAVA_BASE_MS + 10));
  });
});
