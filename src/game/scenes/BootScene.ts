import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { setMusicVolume, MENU_MUSIC_KEY, MENU_MUSIC_PATH, GAME_MUSIC_KEY, GAME_MUSIC_PATH } from "../music";
import { setSfxVolume, SFX_ASSETS } from "../sfx";
import { getMusicVolume, getSfxVolume } from "../../persistence/settings";

/** Loads every asset the game will ever need, once, before the main menu appears — collapsing the
 * gap that let the intro track bleed into a run (research R1/R2) and giving the spinner (index.html)
 * something real to cover from first paint. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    if (!this.cache.audio.exists(MENU_MUSIC_KEY)) {
      this.load.audio(MENU_MUSIC_KEY, MENU_MUSIC_PATH);
    }
    if (!this.cache.audio.exists(GAME_MUSIC_KEY)) {
      this.load.audio(GAME_MUSIC_KEY, GAME_MUSIC_PATH);
    }
    for (const [key, path] of SFX_ASSETS) {
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, path);
      }
    }
    for (const key of ["lever-off", "lever-on"]) {
      if (!this.textures.exists(key)) this.load.svg(key, `/icons/${key}.svg`, { width: 64, height: 64 });
    }
  }

  create(): void {
    setMusicVolume(getMusicVolume());
    setSfxVolume(getSfxVolume());
    document.getElementById("loading-overlay")?.remove();

    const ctx = this.registry.get("ctx") as GameContext;
    this.scene.start(ctx.save.isDead ? "DeathScreenScene" : "MainMenuScene");
  }
}
