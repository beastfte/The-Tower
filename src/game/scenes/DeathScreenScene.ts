import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { resumeFromCheckpoint, returnToMainMenu } from "../../domain/hazard/recovery";
import { createMenuOption } from "../ui/MenuOption";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../gameConfig";

/** FR-013c/FR-013d: shown when the player dies to hazard damage; offers both recovery choices. */
export class DeathScreenScene extends Phaser.Scene {
  constructor() {
    super("DeathScreenScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a0508, 0.95);

    const title = createUiText("You have died", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 3,
      fontSize: 16,
      color: "#d1495b",
    });
    getUiRoot().appendChild(title);
    this.events.once("shutdown", () => title.remove());

    // 027 FR-028 (contract C15): name the killer after a combat death. Read from the save, not
    // scene data, so it survives relaunching the game while dead (FR-029). Trap deaths: no line.
    const cause = (this.registry.get("ctx") as GameContext).save.deathCause;
    if (cause) {
      const line = createUiText(`Slain by ${cause}`, {
        x: DESIGN_WIDTH / 2,
        y: DESIGN_HEIGHT / 3 + 22,
        fontSize: 10,
        color: "#e0c9a6",
      });
      line.dataset.testid = "death-cause";
      getUiRoot().appendChild(line);
      this.events.once("shutdown", () => line.remove());
    }

    createMenuOption(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2,
      label: "[ Resume from last checkpoint ] (Enter)",
      key: "ENTER",
      onActivate: () => this.resume(),
    });

    createMenuOption(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 + 24,
      label: "[ Return to main menu ] (Esc)",
      key: "ESC",
      onActivate: () => this.toMainMenu(),
    });
  }

  private resume(): void {
    const ctx = this.registry.get("ctx") as GameContext;
    ctx.save = resumeFromCheckpoint(ctx.save, ctx.currentFloor);
    ctx.persist();
    this.scene.start("FloorScene");
  }

  private toMainMenu(): void {
    const ctx = this.registry.get("ctx") as GameContext;
    ctx.save = returnToMainMenu(ctx.save);
    ctx.persist();
    this.scene.start("MainMenuScene");
  }
}
