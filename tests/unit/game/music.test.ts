import { describe, expect, it, vi } from "vitest";
import {
  playMusic,
  pauseMusic,
  resumeMusic,
  getMusicVolume,
  setMusicVolume,
  MENU_MUSIC_KEY,
  GAME_MUSIC_KEY,
} from "../../../src/game/music";

/** Minimal stand-in for a Phaser.Sound.BaseSound instance — just enough for music.ts to drive. */
function createStubSound() {
  return {
    isPlaying: false,
    play: vi.fn(function (this: { isPlaying: boolean }) {
      this.isPlaying = true;
    }),
    pause: vi.fn(function (this: { isPlaying: boolean }) {
      this.isPlaying = false;
    }),
    resume: vi.fn(function (this: { isPlaying: boolean }) {
      this.isPlaying = true;
    }),
    setVolume: vi.fn(),
  };
}
type StubSound = ReturnType<typeof createStubSound>;

/** Minimal stand-in for a Phaser.Sound.BaseSoundManager — no Phaser, no canvas, no tower data. */
function createStubSoundManager() {
  const sounds = new Map<string, StubSound>();
  let unlockedCallback: (() => void) | null = null;
  return {
    locked: false,
    sounds,
    get: vi.fn((key: string) => sounds.get(key)),
    add: vi.fn((key: string) => {
      const sound = createStubSound();
      sounds.set(key, sound);
      return sound;
    }),
    stopAll: vi.fn(() => {
      for (const sound of sounds.values()) sound.isPlaying = false;
    }),
    once: vi.fn((event: string, cb: () => void) => {
      if (event === "unlocked") unlockedCallback = cb;
    }),
    triggerUnlock(): void {
      this.locked = false;
      unlockedCallback?.();
    },
  };
}

describe("playMusic", () => {
  it("starts a track looping when nothing is playing", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, MENU_MUSIC_KEY);
    expect(sound.get(MENU_MUSIC_KEY)?.isPlaying).toBe(true);
  });

  it("stops all existing sounds, including paused ones, before starting a different track", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    pauseMusic();
    expect(sound.get(GAME_MUSIC_KEY)?.isPlaying).toBe(false);

    playMusic(sound as never, MENU_MUSIC_KEY);
    expect(sound.stopAll).toHaveBeenCalled();
    expect(sound.get(GAME_MUSIC_KEY)?.isPlaying).toBe(false);
    expect(sound.get(MENU_MUSIC_KEY)?.isPlaying).toBe(true);
  });

  it("is a no-op when the requested track is already playing", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, MENU_MUSIC_KEY);
    const playCallsBefore = sound.get(MENU_MUSIC_KEY)?.play.mock.calls.length;

    playMusic(sound as never, MENU_MUSIC_KEY);

    expect(sound.get(MENU_MUSIC_KEY)?.play.mock.calls.length).toBe(playCallsBefore);
  });

  it("defers playback while locked, and plays once unlocked", () => {
    const sound = createStubSoundManager();
    sound.locked = true;

    playMusic(sound as never, MENU_MUSIC_KEY);
    expect(sound.get(MENU_MUSIC_KEY)).toBeUndefined();

    sound.triggerUnlock();
    expect(sound.get(MENU_MUSIC_KEY)?.isPlaying).toBe(true);
  });

  it("does not play a track that was superseded before the unlock callback fired", () => {
    const sound = createStubSoundManager();
    sound.locked = true;

    playMusic(sound as never, MENU_MUSIC_KEY);
    playMusic(sound as never, GAME_MUSIC_KEY);

    sound.triggerUnlock();

    expect(sound.get(MENU_MUSIC_KEY)).toBeUndefined();
    expect(sound.get(GAME_MUSIC_KEY)?.isPlaying).toBe(true);
  });
});

describe("pauseMusic / resumeMusic", () => {
  it("act on the tracked sound specifically, using pause/resume, never stop/play", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    const track = sound.get(GAME_MUSIC_KEY)!;

    pauseMusic();
    expect(track.pause).toHaveBeenCalled();
    expect(track.isPlaying).toBe(false);

    resumeMusic();
    expect(track.resume).toHaveBeenCalled();
    expect(track.isPlaying).toBe(true);
  });
});

describe("music volume", () => {
  it("creates a newly started track with the current volume in its config", () => {
    const sound = createStubSoundManager();
    setMusicVolume(0.4);

    playMusic(sound as never, MENU_MUSIC_KEY);

    expect(sound.add).toHaveBeenCalledWith(MENU_MUSIC_KEY, { loop: true, volume: 0.4 });
  });

  it("applies a live change to whatever is currently playing, via setVolume", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    const track = sound.get(GAME_MUSIC_KEY)!;

    setMusicVolume(0.25);

    expect(track.setVolume).toHaveBeenCalledWith(0.25);
    expect(getMusicVolume()).toBe(0.25);
  });

  it("preserves the level across a track switch rather than resetting to full", () => {
    const sound = createStubSoundManager();
    setMusicVolume(0.7);

    playMusic(sound as never, MENU_MUSIC_KEY);
    playMusic(sound as never, GAME_MUSIC_KEY);

    expect(sound.add).toHaveBeenLastCalledWith(GAME_MUSIC_KEY, { loop: true, volume: 0.7 });
  });
});
