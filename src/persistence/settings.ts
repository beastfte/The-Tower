const MUSIC_VOLUME_KEY = "fantasy-tower-adventure:music-volume";
const SFX_VOLUME_KEY = "fantasy-tower-adventure:sfx-volume";

/** Shared by every volume preference below: an absent, malformed, non-numeric, or out-of-range
 * stored value resolves to the default `1` rather than throwing (026 research R6). */
function readVolume(key: string): number {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 1;
  return value;
}

/** Device/browser preference, deliberately keyed apart from SAVE_KEY (localStorageAdapter.ts) so
 * nothing that resets a save (New Game, checkpoint restore, return-to-menu) can touch it. */
export function getMusicVolume(): number {
  return readVolume(MUSIC_VOLUME_KEY);
}

export function saveMusicVolume(value: number): void {
  window.localStorage.setItem(MUSIC_VOLUME_KEY, String(value));
}

/** Same device/browser-preference shape as music volume, under its own key — independent of it
 * and of the save (026 FR-011, FR-013). */
export function getSfxVolume(): number {
  return readVolume(SFX_VOLUME_KEY);
}

export function saveSfxVolume(value: number): void {
  window.localStorage.setItem(SFX_VOLUME_KEY, String(value));
}
