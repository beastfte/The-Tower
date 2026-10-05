import Phaser from "phaser";
import { createMenuOption } from "../ui/MenuOption";
import { createVolumeSlider } from "../ui/VolumeSlider";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../gameConfig";
import { getMusicVolume, setMusicVolume } from "../music";
import { getSfxVolume, setSfxVolume } from "../sfx";
import { saveMusicVolume, saveSfxVolume } from "../../persistence/settings";

/** Reachable only from the main menu (FR-003). No keyboard shortcuts anywhere here — pointer-only,
 * per the project rule in CLAUDE.md — so Back is a clickable control, not an Esc binding. */
export class OptionsMenuScene extends Phaser.Scene {
  constructor() {
    super("OptionsMenuScene");
  }

  create(): void {
    const title = createUiText("Options", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 3,
      fontSize: 12,
      color: "#e0c9a6",
    });
    const label = createUiText("Music volume", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 - 16,
      fontSize: 9,
      color: "#e0c9a6",
    });
    const root = getUiRoot();
    root.appendChild(title);
    root.appendChild(label);
    this.events.once("shutdown", () => {
      title.remove();
      label.remove();
    });

    createVolumeSlider(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2,
      value: getMusicVolume(),
      onChange: (value) => {
        setMusicVolume(value);
        saveMusicVolume(value);
      },
    });

    const sfxLabel = createUiText("Sound volume", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 + 24,
      fontSize: 9,
      color: "#e0c9a6",
    });
    root.appendChild(sfxLabel);
    this.events.once("shutdown", () => sfxLabel.remove());

    createVolumeSlider(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 + 40,
      value: getSfxVolume(),
      onChange: (value) => {
        setSfxVolume(value);
        saveSfxVolume(value);
      },
    });

    createMenuOption(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 + 80,
      label: "[ Back ]",
      onActivate: () => this.scene.start("MainMenuScene"),
    });
  }
}
