import { describe, expect, it, beforeEach } from "vitest";
import { getMusicVolume, saveMusicVolume, getSfxVolume, saveSfxVolume } from "../../../src/persistence/settings";

const SAVE_KEY = "fantasy-tower-adventure:save";
const MUSIC_VOLUME_KEY = "fantasy-tower-adventure:music-volume";
const SFX_VOLUME_KEY = "fantasy-tower-adventure:sfx-volume";

/** Node's test environment has no `window`/`localStorage` — stub the minimal surface settings.ts
 * actually calls, fresh per test so nothing leaks between cases. */
function stubLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  (globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = { localStorage };
  return store;
}

beforeEach(() => {
  stubLocalStorage();
});

describe("getMusicVolume", () => {
  it("defaults to 1 when nothing is stored", () => {
    expect(getMusicVolume()).toBe(1);
  });

  it.each(["not-a-number", "-0.5", "1.5", "NaN", "Infinity"])(
    "defaults to 1 for a malformed/out-of-range stored value (%s)",
    (raw) => {
      window.localStorage.setItem(MUSIC_VOLUME_KEY, raw);
      expect(getMusicVolume()).toBe(1);
    },
  );

  it("round-trips a written value", () => {
    saveMusicVolume(0.3);
    expect(getMusicVolume()).toBe(0.3);
  });

  it("uses a key distinct from the save key, so clearing a save cannot clear it", () => {
    saveMusicVolume(0.2);
    window.localStorage.removeItem(SAVE_KEY);
    expect(getMusicVolume()).toBe(0.2);
  });
});

describe("getSfxVolume", () => {
  it("defaults to 1 when nothing is stored", () => {
    expect(getSfxVolume()).toBe(1);
  });

  it.each(["not-a-number", "-0.5", "1.5", "NaN", "Infinity"])(
    "defaults to 1 for a malformed/out-of-range stored value (%s)",
    (raw) => {
      window.localStorage.setItem(SFX_VOLUME_KEY, raw);
      expect(getSfxVolume()).toBe(1);
    },
  );

  it("round-trips a written value", () => {
    saveSfxVolume(0.3);
    expect(getSfxVolume()).toBe(0.3);
  });

  it("uses a key distinct from the save key, so clearing a save cannot clear it", () => {
    saveSfxVolume(0.2);
    window.localStorage.removeItem(SAVE_KEY);
    expect(getSfxVolume()).toBe(0.2);
  });

  it("is independent of the music volume key", () => {
    saveMusicVolume(0.9);
    saveSfxVolume(0.1);
    expect(getMusicVolume()).toBe(0.9);
    expect(getSfxVolume()).toBe(0.1);
  });
});
