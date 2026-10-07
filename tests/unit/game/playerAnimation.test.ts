import { describe, expect, it } from "vitest";
import {
  computePlayerAttackFrame,
  computePlayerIdleFrame,
  computePlayerWalkFrame,
  facingForDirection,
  PLAYER_ATTACK_FRAME_MS,
  PLAYER_ATTACK_MS,
  PLAYER_IDLE_FRAME_MS,
  PLAYER_WALK_FRAME_MS,
} from "../../../src/game/playerAnimation";

describe("computePlayerWalkFrame", () => {
  it("cycles stepA -> idle -> stepB -> idle across the walk sequence", () => {
    expect(computePlayerWalkFrame(0)).toBe("stepA");
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS)).toBe("idle");
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS * 2)).toBe("stepB");
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS * 3)).toBe("idle");
  });

  it("wraps back to stepA after a full 4-slot cycle", () => {
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS * 4)).toBe("stepA");
  });

  it("holds a frame for its whole slot, not just at the boundary", () => {
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS + 1)).toBe("idle");
    expect(computePlayerWalkFrame(PLAYER_WALK_FRAME_MS * 2 - 1)).toBe("idle");
  });
});

describe("computePlayerIdleFrame", () => {
  it("cycles idle -> breath across the idle sequence", () => {
    expect(computePlayerIdleFrame(0)).toBe("idle");
    expect(computePlayerIdleFrame(PLAYER_IDLE_FRAME_MS)).toBe("breath");
  });

  it("wraps back to idle after a full 2-slot cycle", () => {
    expect(computePlayerIdleFrame(PLAYER_IDLE_FRAME_MS * 2)).toBe("idle");
  });

  it("holds a frame for its whole slot, not just at the boundary", () => {
    expect(computePlayerIdleFrame(PLAYER_IDLE_FRAME_MS - 1)).toBe("idle");
    expect(computePlayerIdleFrame(PLAYER_IDLE_FRAME_MS + 1)).toBe("breath");
  });
});

describe("facingForDirection", () => {
  it("maps every CardinalDirection to its sheet-facing equivalent (data-model.md §2)", () => {
    expect(facingForDirection("up")).toBe("back");
    expect(facingForDirection("down")).toBe("front");
    expect(facingForDirection("left")).toBe("left");
    expect(facingForDirection("right")).toBe("right");
  });
});

describe("computePlayerAttackFrame (031 contract C3)", () => {
  it("plays attackA then attackB, one frame-hold each", () => {
    expect(computePlayerAttackFrame(0)).toBe("attackA");
    expect(computePlayerAttackFrame(PLAYER_ATTACK_FRAME_MS - 1)).toBe("attackA");
    expect(computePlayerAttackFrame(PLAYER_ATTACK_FRAME_MS)).toBe("attackB");
    expect(computePlayerAttackFrame(PLAYER_ATTACK_MS - 1)).toBe("attackB");
  });

  it("returns null once the two frames are over, so the caller settles to idle", () => {
    expect(PLAYER_ATTACK_MS).toBe(300);
    expect(computePlayerAttackFrame(PLAYER_ATTACK_MS)).toBeNull();
    expect(computePlayerAttackFrame(10_000)).toBeNull();
  });
});
