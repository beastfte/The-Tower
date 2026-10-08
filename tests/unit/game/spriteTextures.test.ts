import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import { monsterSpriteKey } from "../../../src/game/render/spriteTextures";

describe("monsterSpriteKey (036 contract C2)", () => {
  it("returns the elite key for an elite with elite art", () => {
    expect(monsterSpriteKey("goblin", true)).toBe("goblinElite");
  });

  it("returns the base key when not elite or unset", () => {
    expect(monsterSpriteKey("goblin", false)).toBe("goblin");
    expect(monsterSpriteKey("goblin", undefined)).toBe("goblin");
  });

  it("falls back to the base key when there is no elite art", () => {
    expect(monsterSpriteKey("merchantIdle", true)).toBe("merchantIdle");
    expect(monsterSpriteKey("noSuchMonster", true)).toBe("noSuchMonster");
  });
});
