import Phaser from "phaser";
import { createMenuOption } from "../ui/MenuOption";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { scalePx, RENDER_SCALE } from "../scaleConfig";
import { ensureSpriteTexture } from "../render/spriteTextures";
import { computeMerchantIdleFrame } from "../merchantAnimation";
import { DIALOGUE_BAR_HEIGHT, DIALOGUE_BAR_Y, DIALOGUE_PORTRAIT_SIZE, type NpcDialogueOption } from "../npcDialogue";

export interface NpcDialogueData {
  npcName: string;
  portrait: { idleKey: string; breathKey: string };
  lines: readonly string[];
  /** Called once on open and again after every `onSelect` resolves, so the dialogue always
   * shows current content without being relaunched from outside (research R19). */
  getOptions: () => readonly NpcDialogueOption[];
  onClose: () => void;
}

/**
 * 023 US3 (2026-09-30 amendment): a reusable NPC dialogue box — a bottom-anchored bar that
 * leaves the floor undimmed above it, with an enlarged, still-animating portrait on the left
 * (contracts C14, C15). Content-agnostic (FR-015): this scene holds no knowledge of gold,
 * prices, or upgrades, only how to render whatever `getOptions()` returns and re-fetch it after
 * a selection (contract C17). Binds no keyboard handler anywhere (contract C19) — the only way
 * to select an option or close the dialogue is by clicking.
 *
 * Replaces `ShopMenuScene`. Unlike that scene's full/centered overlay, only the bottom portion
 * of PLAY_AREA is covered.
 */
export class NpcDialogueScene extends Phaser.Scene {
  private data_!: NpcDialogueData;
  private portrait_!: Phaser.GameObjects.Image;
  private optionButtons_: HTMLButtonElement[] = [];
  private domNodes_: HTMLDivElement[] = [];

  constructor() {
    super("NpcDialogueScene");
  }

  init(data: NpcDialogueData): void {
    this.data_ = data;
  }

  create(): void {
    const barCanvasHeight = DIALOGUE_BAR_HEIGHT * RENDER_SCALE;
    const barCanvasY = PLAY_AREA.y + PLAY_AREA.height - barCanvasHeight;
    const barCenterX = PLAY_AREA.x + PLAY_AREA.width / 2;
    const barCenterY = barCanvasY + barCanvasHeight / 2;

    // Canvas: panel background and portrait only — everything readable is DOM (research R14).
    this.add.rectangle(barCenterX, barCenterY, PLAY_AREA.width, barCanvasHeight, 0x0a0a0c, 0.92);

    const portraitCanvasSize = DIALOGUE_PORTRAIT_SIZE * RENDER_SCALE;
    const portraitCenterX = PLAY_AREA.x + scalePx(12) + portraitCanvasSize / 2;
    const portraitKey = ensureSpriteTexture(this, this.data_.portrait.idleKey);
    this.portrait_ = this.add.image(portraitCenterX, barCenterY, portraitKey);
    this.portrait_.setDisplaySize(portraitCanvasSize, portraitCanvasSize);

    const dPortraitRight = DESIGN_PLAY_AREA.x + 12 + DIALOGUE_PORTRAIT_SIZE;
    const dBarTop = DIALOGUE_BAR_Y;
    const dBarRight = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width;

    const name = createUiText(this.data_.npcName, {
      x: DESIGN_PLAY_AREA.x + 12 + DIALOGUE_PORTRAIT_SIZE / 2,
      y: dBarTop + DIALOGUE_PORTRAIT_SIZE + 10,
      fontSize: 9,
      color: "#e0c9a6",
    });
    getUiRoot().appendChild(name);
    this.domNodes_.push(name);

    const lines = createUiText(this.data_.lines.join(" "), {
      x: dPortraitRight + 10,
      originX: 0,
      y: dBarTop + 14,
      fontSize: 8,
      color: "#c9c2d6",
      align: "left",
      maxWidth: dBarRight - dPortraitRight - 20,
    });
    getUiRoot().appendChild(lines);
    this.domNodes_.push(lines);

    createMenuOption(this, {
      x: dBarRight - 12,
      y: dBarTop + 10,
      label: "✕",
      fontSize: 11,
      color: "#e0c9a6",
      onActivate: () => this.data_.onClose(),
    });

    const rowsCenterX = dPortraitRight + (dBarRight - dPortraitRight) / 2;
    this.renderOptions(rowsCenterX, dBarTop + 40);

    this.events.once("shutdown", () => {
      this.domNodes_.forEach((el) => el.remove());
      this.optionButtons_.forEach((btn) => btn.remove());
    });
  }

  /** Renders the current option rows, replacing any that already exist. Called on open and
   * again after every purchase (contract C17, research R19) — never a full scene restart, so
   * the portrait's animation (update()) keeps running uninterrupted. */
  private renderOptions(centerX: number, startY: number): void {
    this.optionButtons_.forEach((btn) => btn.remove());
    this.optionButtons_ = [];

    this.data_.getOptions().forEach((option, index) => {
      const button = createMenuOption(this, {
        x: centerX,
        y: startY + index * 14,
        label: option.text,
        fontSize: 8,
        disabled: option.disabled,
        onActivate: () => {
          option.onSelect();
          this.renderOptions(centerX, startY);
        },
      });
      this.optionButtons_.push(button);
    });
  }

  override update(time: number): void {
    const frame = computeMerchantIdleFrame(time);
    const key = ensureSpriteTexture(
      this,
      frame === "idle" ? this.data_.portrait.idleKey : this.data_.portrait.breathKey,
    );
    if (this.portrait_.texture.key !== key) {
      this.portrait_.setTexture(key);
    }
  }
}
