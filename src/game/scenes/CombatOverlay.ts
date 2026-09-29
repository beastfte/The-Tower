import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type { EnemyDefinition } from "../../domain/floor/types";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { createUiText, getUiRoot, px } from "../ui/domOverlay";
import { scalePx } from "../scaleConfig";
import { foldTurnsToLines } from "../combatLogReveal";

export interface CombatOverlayData {
  enemy: EnemyDefinition;
  /** 019 FR-003: the monster's display name (e.g. "Goblin"), resolved by the caller —
   * never `enemy.id`, which is an internal placement identifier. */
  enemyName: string;
  encounter: EncounterResult;
  /** The player's HP at the moment the encounter was simulated (research.md turn-display design). */
  playerStartHp: number;
  onComplete: () => void;
}

const TURN_DELAY_MS = 325;

/**
 * FR-012/FR-012a + 002 FR-012/FR-013: replays the pre-computed EncounterResult
 * turn-by-turn, explicitly showing the attacker, damage dealt, and both combatants'
 * current remaining HP each turn, then clearly presents the final win/loss outcome
 * before resuming floor control. Occupies only PLAY_AREA (002 FR-007), never the side
 * panel or event log.
 *
 * 022 US2 (contracts C6/C7): while revealing, any key press shows every remaining turn and the
 * outcome at once but does NOT close the encounter. Once the outcome is shown (by pacing or by
 * that skip), any key press closes it — there is no timer that closes the encounter on its own.
 */
export class CombatOverlay extends Phaser.Scene {
  private data_!: CombatOverlayData;
  private logText!: HTMLDivElement;
  private outcomeText!: HTMLDivElement;
  /** 022 US2 (data-model "Added: CombatOverlay reveal state"): false while turns are still being
   * paced out, true once every turn and the outcome are on screen — selects which of the two
   * key-press behaviours applies. */
  private revealed = false;
  private pendingTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("CombatOverlay");
  }

  init(data: CombatOverlayData): void {
    this.data_ = data;
    this.revealed = false;
    this.pendingTimer = undefined;
  }

  create(): void {
    const { x, y, width, height } = PLAY_AREA;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const dcx = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2;

    this.add
      .rectangle(cx, cy, width - scalePx(12), height - scalePx(12), 0x120a10, 0.94)
      .setDepth(0);

    const encounterLabel = createUiText(`Encounter: ${this.data_.enemyName}`, {
      x: dcx,
      y: DESIGN_PLAY_AREA.y + 8,
      originX: 0.5,
      originY: 0,
      fontSize: 10,
      color: "#e0c9a6",
    });

    this.logText = createUiText("", {
      x: dcx,
      y: DESIGN_PLAY_AREA.y + 26,
      originX: 0.5,
      originY: 0,
      fontSize: 8,
      color: "#f2e9d8",
      align: "center",
      maxWidth: DESIGN_PLAY_AREA.width - 40,
    });
    this.logText.dataset.testid = "combat-log";
    /** 010 US3: fixed height + native overflow scroll — top margin clears the encounter
     * label, bottom margin reserves outcomeText's space — so the log can never grow tall
     * enough to overlap outcomeText or spill past the combat screen's own background rect. */
    this.logText.style.height = px(DESIGN_PLAY_AREA.height - 26 - 40);
    this.logText.style.overflowY = "auto";

    this.outcomeText = createUiText("", {
      x: dcx,
      y: DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height - 14,
      originX: 0.5,
      originY: 1,
      fontSize: 12,
      color: "#f2e9d8",
    });
    this.outcomeText.style.display = "none";

    const root = getUiRoot();
    root.appendChild(encounterLabel);
    root.appendChild(this.logText);
    root.appendChild(this.outcomeText);
    this.events.once("shutdown", () => {
      encounterLabel.remove();
      this.logText.remove();
      this.outcomeText.remove();
    });

    // 022 US2 (contracts C6/C7/C8): any key reveals the rest while revealing, or closes the
    // encounter once revealed. Owned by this scene's own input, so it dies with it (contract C10).
    this.input.keyboard!.on("keydown", this.handleKeyDown, this);

    this.playTurns(0, this.data_.playerStartHp, this.data_.enemy.stats.hp, "");
  }

  private handleKeyDown(): void {
    if (this.revealed) {
      this.data_.onComplete();
    } else {
      this.revealRemaining();
    }
  }

  /**
   * 002 FR-012: each turn line names the attacker, the damage dealt, and both
   * combatants' HP remaining after that turn.
   */
  private playTurns(index: number, playerHp: number, enemyHp: number, logSoFar: string): void {
    if (index >= this.data_.encounter.turns.length) {
      this.pendingTimer = this.time.delayedCall(TURN_DELAY_MS, () => this.showOutcome());
      return;
    }
    const turn = this.data_.encounter.turns[index]!;
    const folded = foldTurnsToLines([turn], playerHp, enemyHp, this.data_.enemyName);
    const nextLog = logSoFar + folded.lines[0] + "\n";
    this.logText.textContent = nextLog;
    this.logText.scrollTop = this.logText.scrollHeight;
    this.pendingTimer = this.time.delayedCall(TURN_DELAY_MS, () =>
      this.playTurns(index + 1, folded.playerHp, folded.enemyHp, nextLog),
    );
  }

  /** 022 US2 (contract C6): cancels the paced reveal and renders every remaining turn (and the
   * outcome) at once. Recomputes the whole log from the start via `foldTurnsToLines` rather than
   * threading extra "how far did we get" state through — cheap, and guarantees this can never
   * drift from what the paced reveal would have shown. */
  private revealRemaining(): void {
    this.pendingTimer?.remove();
    this.pendingTimer = undefined;

    const { lines } = foldTurnsToLines(
      this.data_.encounter.turns,
      this.data_.playerStartHp,
      this.data_.enemy.stats.hp,
      this.data_.enemyName,
    );
    this.logText.textContent = lines.map((line) => `${line}\n`).join("");
    this.logText.scrollTop = this.logText.scrollHeight;
    this.showOutcome();
  }

  /** 002 FR-013: clearly presents the final outcome; 002 FR-015: logs the encounter. bug fix:
   * currency-not-logged — the enemy's currency drop (if any) is folded into this same log entry.
   * 022 US2 (contract C7): no longer closes itself on a timer — the encounter now waits
   * indefinitely for a key press, handled by `handleKeyDown` once `revealed` is true. */
  private showOutcome(): void {
    this.revealed = true;
    const ctx = this.registry.get("ctx") as GameContext | undefined;
    ctx?.logCombatEncounter(this.data_.enemyName, this.data_.encounter, this.data_.enemy.drops?.currency);

    const won = this.data_.encounter.winner === "player";
    this.outcomeText.textContent = won ? "Victory!" : "Defeat...";
    this.outcomeText.style.color = won ? "#8ecae6" : "#d1495b";
    this.outcomeText.style.display = "";
  }
}
