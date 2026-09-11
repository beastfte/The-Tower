import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { createInitialPlayerSave } from "../../domain/character/initialState";
import { createMenuOption } from "../ui/MenuOption";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../gameConfig";

/** New game / continue entry point (used at app start and after "return to main menu"). */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const ctx = this.registry.get("ctx") as GameContext;

    const title = createUiText("The Tower", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 3,
      fontSize: 12,
      color: "#e0c9a6",
    });
    getUiRoot().appendChild(title);
    this.events.once("shutdown", () => title.remove());

    const existingSave = ctx.persistence.load();
    // 002 FR-008a: a save that has already been won offers no "Continue" at all — normal
    // play stays stopped once won (001 FR-011a), and re-opening the win screen offers the
    // player nothing new, so only "New Game" is available for a won save.
    const canContinue = existingSave !== null && !existingSave.hasWon;

    if (canContinue) {
      createMenuOption(this, {
        x: DESIGN_WIDTH / 2,
        y: DESIGN_HEIGHT / 2,
        label: "[ Continue ] (Enter)",
        key: "ENTER",
        onActivate: () => this.scene.start("FloorScene"),
      });
    }

    createMenuOption(this, {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 + 24,
      label: "[ New Game ] (N)",
      key: "N",
      onActivate: () => {
        const firstFloor = ctx.tower.floors[0]!;
        ctx.save = createInitialPlayerSave(firstFloor.id, firstFloor.entrance);
        ctx.persist();
        this.scene.start("FloorScene");
      },
    });
  }
}
