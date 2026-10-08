import { describe, expect, it, vi } from "vitest";
import {
  playMusic,
  pauseMusic,
  resumeMusic,
  getMusicVolume,
  setMusicVolume,
  MENU_MUSIC_KEY,
  GAME_MUSIC_KEY,
  COMBAT_MUSIC_KEY,
} from "../../../src/game/music";

/** Minimal stand-in for a Phaser.Sound.BaseSound instance — just enough for music.ts to drive. */
function createStubSound() {
  type State = { isPlaying: boolean; isPaused: boolean };
  return {
    isPlaying: false,
    isPaused: false,
    play: vi.fn(function (this: State) {
      this.isPlaying = true;
      this.isPaused = false;
    }),
    pause: vi.fn(function (this: State) {
      if (!this.isPlaying) return;
      this.isPlaying = false;
      this.isPaused = true;
    }),
    resume: vi.fn(function (this: State) {
      if (!this.isPaused) return;
      this.isPlaying = true;
      this.isPaused = false;
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

  it("pauses only the outgoing track when switching — never stopAll, which would cut sound effects", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);

    playMusic(sound as never, COMBAT_MUSIC_KEY);

    expect(sound.stopAll).not.toHaveBeenCalled();
    expect(sound.get(GAME_MUSIC_KEY)?.pause).toHaveBeenCalled();
    expect(sound.get(GAME_MUSIC_KEY)?.isPlaying).toBe(false);
    expect(sound.get(COMBAT_MUSIC_KEY)?.isPlaying).toBe(true);
  });

  it("keeps a pause-menu-paused track silent when switching away from it", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    pauseMusic();

    playMusic(sound as never, MENU_MUSIC_KEY);

    expect(sound.get(GAME_MUSIC_KEY)?.isPlaying).toBe(false);
    expect(sound.get(MENU_MUSIC_KEY)?.isPlaying).toBe(true);
  });

  it("resumes a previously switched-away track rather than restarting it", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    const floor = sound.get(GAME_MUSIC_KEY)!;
    playMusic(sound as never, COMBAT_MUSIC_KEY);

    playMusic(sound as never, GAME_MUSIC_KEY);

    expect(floor.resume).toHaveBeenCalled();
    expect(floor.play).toHaveBeenCalledTimes(1);
    expect(floor.isPlaying).toBe(true);
    expect(sound.get(COMBAT_MUSIC_KEY)?.isPlaying).toBe(false);
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

  it("applies a level changed while a track was paused when that track is resumed", () => {
    const sound = createStubSoundManager();
    playMusic(sound as never, GAME_MUSIC_KEY);
    playMusic(sound as never, COMBAT_MUSIC_KEY);
    playMusic(sound as never, GAME_MUSIC_KEY); // combat is now paused, not current
    setMusicVolume(0.2);
    const combat = sound.get(COMBAT_MUSIC_KEY)!;
    combat.setVolume.mockClear();

    playMusic(sound as never, COMBAT_MUSIC_KEY);

    expect(combat.setVolume).toHaveBeenCalledWith(0.2);
  });

  it("preserves the level across a track switch rather than resetting to full", () => {
    const sound = createStubSoundManager();
    setMusicVolume(0.7);

    playMusic(sound as never, MENU_MUSIC_KEY);
    playMusic(sound as never, GAME_MUSIC_KEY);

    expect(sound.add).toHaveBeenLastCalledWith(GAME_MUSIC_KEY, { loop: true, volume: 0.7 });
  });
});
