const MUSIC_VOLUME_KEY = "fantasy-tower-adventure:music-volume";

/** Device/browser preference, deliberately keyed apart from SAVE_KEY (localStorageAdapter.ts) so
 * nothing that resets a save (New Game, checkpoint restore, return-to-menu) can touch it. */
export function getMusicVolume(): number {
  const raw = window.localStorage.getItem(MUSIC_VOLUME_KEY);
  if (raw === null) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 1;
  return value;
}

export function saveMusicVolume(value: number): void {
  window.localStorage.setItem(MUSIC_VOLUME_KEY, String(value));
}
