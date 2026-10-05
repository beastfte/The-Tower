import Phaser from "phaser";
import { createMenuOption } from "../ui/MenuOption";
import { createVolumeSlider } from "../ui/VolumeSlider";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { scalePx } from "../scaleConfig";
import { getMusicVolume, setMusicVolume } from "../music";
import { getSfxVolume, setSfxVolume } from "../sfx";
import { saveMusicVolume, saveSfxVolume } from "../../persistence/settings";

export interface PauseMenuData {
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
}

/**
 * FR-002/FR-003/FR-004: launched on top of a paused FloorScene (see FloorScene.openPauseMenu),
 * offering Resume / Restart at last checkpoint / Return to main menu. Owns no domain logic or
 * scene-transition orchestration itself — each option just invokes the matching callback
 * supplied by FloorScene, mirroring PickupModalScene's onDismiss pattern.
 */
export class PauseMenuScene extends Phaser.Scene {
  private data_!: PauseMenuData;

  constructor() {
    super("PauseMenuScene");
  }

  init(data: PauseMenuData): void {
    this.data_ = data;
  }

  create(): void {
    // Occupies only PLAY_AREA (like CombatOverlay/PickupModalScene), not the full canvas —
    // SidePanelScene/EventLogScene stay visible and operable while paused (unlike death/win,
    // which stop them first), so this overlay must never draw or center text over them.
    const { x, y, width, height } = PLAY_AREA;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const dcx = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2;
    const dcy = DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height / 2;

    this.add.rectangle(cx, cy, width - scalePx(12), height - scalePx(12), 0x0a0a0c, 0.9);

    const title = createUiText("Paused", {
      x: dcx,
      y: dcy - 40,
      fontSize: 14,
      color: "#e0c9a6",
    });
    getUiRoot().appendChild(title);
    this.events.once("shutdown", () => title.remove());

    createMenuOption(this, {
      x: dcx,
      y: dcy - 12,
      label: "[ Resume ] (Esc)",
      key: "ESC",
      fontSize: 8,
      onActivate: () => this.data_.onResume(),
    });

    createMenuOption(this, {
      x: dcx,
      y: dcy + 8,
      label: "[ Restart at last checkpoint ] (Enter)",
      key: "ENTER",
      fontSize: 8,
      onActivate: () => this.data_.onRestart(),
    });

    createMenuOption(this, {
      x: dcx,
      y: dcy + 28,
      label: "[ Return to main menu ] (M)",
      key: "M",
      fontSize: 8,
      onActivate: () => this.data_.onReturnToMenu(),
    });

    const volumeLabel = createUiText("Music volume", {
      x: dcx,
      y: dcy + 44,
      fontSize: 7,
      color: "#e0c9a6",
    });
    getUiRoot().appendChild(volumeLabel);
    this.events.once("shutdown", () => volumeLabel.remove());

    createVolumeSlider(this, {
      x: dcx,
      y: dcy + 56,
      value: getMusicVolume(),
      onChange: (value) => {
        setMusicVolume(value);
        saveMusicVolume(value);
      },
    });

    const sfxVolumeLabel = createUiText("Sound volume", {
      x: dcx,
      y: dcy + 72,
      fontSize: 7,
      color: "#e0c9a6",
    });
    getUiRoot().appendChild(sfxVolumeLabel);
    this.events.once("shutdown", () => sfxVolumeLabel.remove());

    createVolumeSlider(this, {
      x: dcx,
      y: dcy + 84,
      value: getSfxVolume(),
      onChange: (value) => {
        setSfxVolume(value);
        saveSfxVolume(value);
      },
    });
  }
}
