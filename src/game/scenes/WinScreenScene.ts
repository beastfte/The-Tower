import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { createMenuOption } from "../ui/MenuOption";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../gameConfig";

/** FR-011/FR-011a: shown once the end boss is defeated. Terminal — the playthrough is over. */
export class WinScreenScene extends Phaser.Scene {
  constructor() {
    super("WinScreenScene");
  }

  create(): void {
    const { width, height } = this.scale;
    const ctx = this.registry.get("ctx") as GameContext;
    const { character } = ctx.save;
    // 002 US2/AC3 (converge T042): the final floor is reached by defeating its end boss,
    // not by completeCurrentFloor(), so it's never added to completedFloorIds — add 1 for it.
    const floorsReached = ctx.save.completedFloorIds.length + 1;
    const totalFloors = ctx.tower.floors.length;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0c, 0.97);

    const title = createUiText("The Tower is Conquered", {
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 4,
      fontSize: 14,
      color: "#8ecae6",
    });

    const summary = createUiText(
      [
        "You have defeated the end boss and reached the top of the tower.",
        "",
        `Floors reached: ${floorsReached} of ${totalFloors}`,
        `Currency collected: ${character.currency}`,
        `Loot items collected: ${character.inventory.length}`,
      ].join("\n"),
      { x: DESIGN_WIDTH / 2, y: DESIGN_HEIGHT / 2, fontSize: 9, color: "#e0c9a6", align: "center" },
    );
    summary.dataset.testid = "win-summary";

    const root = getUiRoot();
    root.appendChild(title);
    root.appendChild(summary);
    this.events.once("shutdown", () => {
      title.remove();
      summary.remove();
    });

    // 002 FR-010a: navigation only — the completed playthrough's save is never mutated,
    // so "Continue" on this save keeps returning here (FR-008a) rather than resetting it.
    createMenuOption(this, {
      x: DESIGN_WIDTH / 2,
      y: (DESIGN_HEIGHT * 3) / 4,
      label: "[ Return to main menu ] (Esc)",
      key: "ESC",
      onActivate: () => this.scene.start("MainMenuScene"),
    });
  }
}
