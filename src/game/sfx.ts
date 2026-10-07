import type Phaser from "phaser";
import type { ItemKind } from "../domain/floor/types";
import type { BattleEvent } from "../domain/combat/battle";
import type { BattleEndOutcome } from "./battleResult";

/** Cache keys for every sound effect (026's nine plus 028's five combat cues), paired with their
 * asset paths for BootScene's preload loop (paths are URL-rooted since Vite serves public/ at /, mirroring
 * music.ts's *_KEY/*_PATH convention — 026 research R1, R12). */
export const sfxClick = "sfxClick";
export const sfxHover = "sfxHover";
export const sfxError = "sfxError";
export const sfxChest = "sfxChest";
export const sfxDoor = "sfxDoor";
export const sfxCoin = "sfxCoin";
export const sfxEquipment = "sfxEquipment";
export const sfxKey = "sfxKey";
export const sfxPotion = "sfxPotion";
/** 028: combat cues (data-model.md). */
export const sfxEncounter = "sfxEncounter";
export const sfxVictory = "sfxVictory";
export const sfxDeath = "sfxDeath";
export const sfxPlayerAttack = "sfxPlayerAttack";
export const sfxPlayerHurt = "sfxPlayerHurt";

export const SFX_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  [sfxClick, "/Sound/Button click.wav"],
  [sfxHover, "/Sound/Menu option onhover.wav"],
  [sfxError, "/Sound/Error.wav"],
  [sfxChest, "/Sound/Chest Open.wav"],
  [sfxDoor, "/Sound/Door unlock.wav"],
  [sfxCoin, "/Sound/Coin.wav"],
  [sfxEquipment, "/Sound/Equipment.wav"],
  [sfxKey, "/Sound/Key.wav"],
  [sfxPotion, "/Sound/Potion.wav"],
  [sfxEncounter, "/Sound/Encounter start.wav"],
  [sfxVictory, "/Sound/Victory.wav"],
  [sfxDeath, "/Sound/Death.wav"],
  [sfxPlayerAttack, "/Sound/Player attack.wav"],
  [sfxPlayerHurt, "/Sound/Player taking damage.wav"],
];

/** Applied per-sound on every playSfx call — never to the sound manager itself, so a future
 * change to the music slider can't fight this one (mirrors music.ts's musicVolume, research R5). */
let sfxVolume = 1;

export function getSfxVolume(): number {
  return sfxVolume;
}

export function setSfxVolume(value: number): void {
  sfxVolume = value;
}

/**
 * Plays `key` once, at the current sound-effects volume. Each call is an independent one-shot
 * instance — `BaseSoundManager.play` adds a fresh sound and destroys it on completion, so
 * overlapping effects each play in full (research R4). Never calls `stopAll`/`pauseAll`, which
 * would also silence the music track (`music.ts`'s mirror-image care, research R4).
 */
export function playSfx(manager: Phaser.Sound.BaseSoundManager, key: string): void {
  manager.play(key, { volume: sfxVolume });
}

/** Wires the click and hover sounds onto a menu button (research R1) — the one hook point that
 * covers every button built by `createMenuOption`, plus the one hand-built button that isn't
 * (`SidePanelScene`'s pause button). A disabled button dispatches neither event, so a greyed-out
 * option stays silent with no guard needed here (research R2/R3). */
export function attachMenuSounds(scene: Phaser.Scene, button: HTMLButtonElement): void {
  button.addEventListener("click", () => playSfx(scene.sound, sfxClick));
  button.addEventListener("mouseenter", () => playSfx(scene.sound, sfxHover));
}

/** Maps a collected item's kind to the sound it plays on pickup (data-model.md). `loot` has no
 * sound in the feature's set of nine (research R8). */
export function itemKindToSfxKey(kind: ItemKind): string | undefined {
  switch (kind) {
    case "currency":
      return sfxCoin;
    case "key":
      return sfxKey;
    case "potion":
    case "potionAttack":
    case "potionDefense":
      return sfxPotion;
    case "weapon":
    case "armor":
      return sfxEquipment;
    case "chest":
      return sfxChest;
    case "loot":
      return undefined;
  }
}

/** 028: a landed hit plays the attack cue when it lands on the monster and the hurt cue when it
 * lands on the player; crits share their side's cue and heals play nothing (research R2). */
export function battleEventToSfxKey(event: BattleEvent): string | undefined {
  switch (event.kind) {
    case "hit":
      return event.target === "monster" ? sfxPlayerAttack : sfxPlayerHurt;
    case "heal":
    case "dodge":
      return undefined;
  }
}

/** 028: one outcome cue per decided battle; fleeing is silent (FR-007, research R3). */
export function battleOutcomeToSfxKey(outcome: BattleEndOutcome): string | undefined {
  switch (outcome) {
    case "victory":
      return sfxVictory;
    case "defeat":
      return sfxDeath;
    case "fled":
      return undefined;
  }
}
