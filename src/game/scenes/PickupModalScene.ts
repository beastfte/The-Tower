import Phaser from "phaser";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { createMenuOption } from "../ui/MenuOption";
import { scalePx } from "../scaleConfig";
import { pickupModalTitle } from "../pickupModalTitle";

export interface PickupModalData {
  kind: "key" | "potion" | "currency";
  label: string;
  description: string;
  onDismiss: () => void;
}

/**
 * 002 FR-018/FR-019: a blocking pop-up shown the moment a key is collected, briefly
 * describing its effect. Pauses the launching scene (FloorScene or CombatOverlay)
 * until the player explicitly dismisses it (click or the confirm key), reusing the same
 * pause/resume pattern already established by CombatOverlay (research.md #7).
 */
export class PickupModalScene extends Phaser.Scene {
  private data_!: PickupModalData;

  constructor() {
    super("PickupModalScene");
  }

  init(data: PickupModalData): void {
    this.data_ = data;
  }

  create(): void {
    const { x, y, width, height } = PLAY_AREA;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const dcx = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2;
    const dcy = DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height / 2;

    this.add
      .rectangle(cx, cy, width - scalePx(20), height - scalePx(20), 0x120a10, 0.95)
      .setDepth(0);

    // 005 FR-008: a chest's revealed gold reward still renders with the same distinct coin
    // appearance as a floor-standing currency pickup, not text alone. "coin" is already loaded
    // into the shared Phaser texture manager by FloorScene's preload before any modal can launch.
    if (this.data_.kind === "currency" && this.textures.exists("coin")) {
      const coinIcon = this.add.image(cx, cy - scalePx(46), "coin");
      coinIcon.setDisplaySize(scalePx(24), scalePx(24));
    }

    const title = pickupModalTitle(this.data_.kind, this.data_.label);
    const titleEl = createUiText(title, { x: dcx, y: dcy - 30, fontSize: 11, color: "#8ecae6" });
    const labelEl = createUiText(this.data_.label, { x: dcx, y: dcy - 12, fontSize: 10, color: "#e0c9a6" });
    const descriptionEl = createUiText(this.data_.description, {
      x: dcx,
      y: dcy + 6,
      originX: 0.5,
      originY: 0,
      fontSize: 8,
      color: "#f2e9d8",
      align: "center",
      maxWidth: DESIGN_PLAY_AREA.width - 60,
    });

    const root = getUiRoot();
    root.appendChild(titleEl);
    root.appendChild(labelEl);
    root.appendChild(descriptionEl);
    this.events.once("shutdown", () => {
      titleEl.remove();
      labelEl.remove();
      descriptionEl.remove();
    });

    createMenuOption(this, {
      x: dcx,
      y: DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height - 16,
      label: "[ OK ] (Enter)",
      key: "ENTER",
      color: "#e0c9a6",
      fontSize: 9,
      onActivate: () => this.dismiss(),
    });
  }

  private dismiss(): void {
    this.scene.stop("PickupModalScene");
    this.data_.onDismiss();
  }
}
