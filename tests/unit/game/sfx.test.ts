import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  playSfx,
  getSfxVolume,
  setSfxVolume,
  itemKindToSfxKey,
  sfxCoin,
  sfxKey,
  sfxPotion,
  sfxEquipment,
  sfxChest,
} from "../../../src/game/sfx";

/** Minimal stand-in for a Phaser.Sound.BaseSoundManager — no Phaser, no canvas, no tower data,
 * matching music.test.ts's own stub shape. */
function createStubSoundManager() {
  return { play: vi.fn() };
}

beforeEach(() => {
  setSfxVolume(1);
});

describe("playSfx", () => {
  it("plays the given key at the current sound-effects volume", () => {
    const manager = createStubSoundManager();
    setSfxVolume(0.4);

    playSfx(manager as never, "sfxClick");

    expect(manager.play).toHaveBeenCalledWith("sfxClick", { volume: 0.4 });
  });

  it("picks up a volume change made after an earlier call, on the next call", () => {
    const manager = createStubSoundManager();

    playSfx(manager as never, "sfxClick");
    expect(manager.play).toHaveBeenLastCalledWith("sfxClick", { volume: 1 });

    setSfxVolume(0.2);
    playSfx(manager as never, "sfxClick");
    expect(manager.play).toHaveBeenLastCalledWith("sfxClick", { volume: 0.2 });
  });
});

describe("getSfxVolume/setSfxVolume", () => {
  it("defaults to 1 and reflects the last value set", () => {
    expect(getSfxVolume()).toBe(1);
    setSfxVolume(0.6);
    expect(getSfxVolume()).toBe(0.6);
  });
});

describe("itemKindToSfxKey", () => {
  it.each([
    ["currency", sfxCoin],
    ["key", sfxKey],
    ["potion", sfxPotion],
    ["potionAttack", sfxPotion],
    ["potionDefense", sfxPotion],
    ["weapon", sfxEquipment],
    ["armor", sfxEquipment],
    ["chest", sfxChest],
  ] as const)("maps %s to its sound", (kind, expected) => {
    expect(itemKindToSfxKey(kind)).toBe(expected);
  });

  it("maps loot to no sound", () => {
    expect(itemKindToSfxKey("loot")).toBeUndefined();
  });
});
