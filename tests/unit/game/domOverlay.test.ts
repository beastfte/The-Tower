import { describe, expect, it } from "vitest";
import { px } from "../../../src/game/ui/domOverlay";

// `px()` is the only piece of ui/domOverlay.ts that's both pure and DOM-free — everything
// else (getUiRoot, createUiText, syncUiRootToCanvas) touches `document`/Phaser directly and
// is covered instead by the e2e suite (tests/e2e/*.spec.ts), consistent with how this
// codebase already splits Phaser-touching code from plain-function unit tests (see
// src/game/floorLayout.ts vs. its Phaser-based callers).
describe("px", () => {
  it("produces a calc() expression referencing the --px custom property", () => {
    expect(px(264)).toBe("calc(var(--px) * 264)");
  });

  it("passes through fractional and zero design units unchanged", () => {
    expect(px(0)).toBe("calc(var(--px) * 0)");
    expect(px(9.5)).toBe("calc(var(--px) * 9.5)");
  });
});
