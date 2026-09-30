import { describe, expect, it } from "vitest";
import { computeMerchantIdleFrame, MERCHANT_IDLE_FRAME_MS } from "../../../src/game/merchantAnimation";

describe("computeMerchantIdleFrame", () => {
  it("cycles idle -> breath across the idle sequence", () => {
    expect(computeMerchantIdleFrame(0)).toBe("idle");
    expect(computeMerchantIdleFrame(MERCHANT_IDLE_FRAME_MS)).toBe("breath");
  });

  it("wraps back to idle after a full 2-slot cycle", () => {
    expect(computeMerchantIdleFrame(MERCHANT_IDLE_FRAME_MS * 2)).toBe("idle");
  });

  it("holds a frame for its whole slot, not just at the boundary", () => {
    expect(computeMerchantIdleFrame(MERCHANT_IDLE_FRAME_MS - 1)).toBe("idle");
    expect(computeMerchantIdleFrame(MERCHANT_IDLE_FRAME_MS + 1)).toBe("breath");
  });
});
