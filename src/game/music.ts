import type Phaser from "phaser";

/** Cache keys the two tracks are loaded under (BootScene.preload(), not here — every asset the
 * game needs loads there, once, before the main menu appears). Paths are URL-rooted since Vite
 * serves public/ at /. */
export const MENU_MUSIC_KEY = "menuMusic";
export const MENU_MUSIC_PATH = "Sound/Intro Menu Music.wav";
export const GAME_MUSIC_KEY = "gameMusic";
export const GAME_MUSIC_PATH = "Sound/Game background.wav";
/** 028 US3: loops for the length of a battle, outcome panel included (FloorScene owns the switch). */
export const COMBAT_MUSIC_KEY = "combatMusic";
export const COMBAT_MUSIC_PATH = "Sound/Combat soundtrack.wav";

/** Every track, for BootScene's preload loop (mirrors sfx.ts's SFX_ASSETS). */
export const MUSIC_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  [MENU_MUSIC_KEY, MENU_MUSIC_PATH],
  [GAME_MUSIC_KEY, GAME_MUSIC_PATH],
  [COMBAT_MUSIC_KEY, COMBAT_MUSIC_PATH],
];

/** Most recently requested track key. Re-checked by the audio-unlock deferral below so a request
 * superseded by a later one (e.g. the unlock gesture is the same click that leaves the menu)
 * never plays the stale track. */
let requestedKey: string | null = null;

/** The sound pauseMusic/resumeMusic act on — deliberately not the whole manager (pauseAll/resumeAll
 * would also catch a future sound effect mid-play), just the one track we started. */
let currentSound: Phaser.Sound.BaseSound | null = null;

/** Applied to currentSound on change and to each newly created sound — never to the manager itself,
 * so a future sound effect isn't scaled by a slider labelled "Music". */
let musicVolume = 1;

/**
 * Makes `key` the one track that is playing, looping. A no-op if it's already playing (so
 * re-entering a scene's create() — checkpoint restart, death-screen retry — never restarts the
 * loop). Assumes the asset is already cached by BootScene's preload().
 */
export function playMusic(sound: Phaser.Sound.BaseSoundManager, key: string): void {
  requestedKey = key;

  const existing = sound.get(key);
  if (existing?.isPlaying) return;

  if (sound.locked) {
    sound.once("unlocked", () => {
      if (requestedKey === key) start(sound, key);
    });
    return;
  }

  start(sound, key);
}

/** Pauses only the outgoing track — never stopAll, which would also cut a sound effect mid-play
 * (028 research R8) — so a track switched back to later resumes where it left off. */
function start(sound: Phaser.Sound.BaseSoundManager, key: string): void {
  const instance = sound.get(key) ?? sound.add(key, { loop: true, volume: musicVolume });
  if (currentSound !== instance) currentSound?.pause();
  // A reused track kept the level it last played at; the slider may have moved since.
  (instance as unknown as { setVolume(value: number): void }).setVolume(musicVolume);
  if (instance.isPaused) instance.resume();
  else instance.play();
  currentSound = instance;
}

export function getMusicVolume(): number {
  return musicVolume;
}

/** Changes the level immediately on whatever is currently playing (FR-006), and is picked up by the
 * next track started via its { volume } config (so switching tracks doesn't reset to full).
 * `setVolume` is declared on Phaser's concrete WebAudioSound/HTML5AudioSound, not on the common
 * BaseSound type `currentSound` is held as — both backends implement it identically, so this casts
 * structurally rather than naming either concrete class. */
export function setMusicVolume(value: number): void {
  musicVolume = value;
  (currentSound as unknown as { setVolume(value: number): void } | null)?.setVolume(value);
}

/** Silences the currently playing music track (not the whole sound manager). */
export function pauseMusic(): void {
  currentSound?.pause();
}

/** Continues the currently paused music track from where it left off (never restarts it). */
export function resumeMusic(): void {
  currentSound?.resume();
}
