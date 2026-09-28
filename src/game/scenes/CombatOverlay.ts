import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type { EnemyDefinition } from "../../domain/floor/types";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { createUiText, getUiRoot, px } from "../ui/domOverlay";
import { scalePx } from "../scaleConfig";

export interface CombatOverlayData {
  enemy: EnemyDefinition;
  encounter: EncounterResult;
  /** The player's HP at the moment the encounter was simulated (research.md turn-display design). */
  playerStartHp: number;
  onComplete: () => void;
}

const TURN_DELAY_MS = 650;

/**
 * FR-012/FR-012a + 002 FR-012/FR-013: replays the pre-computed EncounterResult
 * turn-by-turn, explicitly showing the attacker, damage dealt, and both combatants'
 * current remaining HP each turn, then clearly presents the final win/loss outcome
 * before resuming floor control. Purely observational — no player input during the
 * fight. Occupies only PLAY_AREA (002 FR-007), never the side panel or event log.
 */
export class CombatOverlay extends Phaser.Scene {
  private data_!: CombatOverlayData;
  private logText!: HTMLDivElement;
  private outcomeText!: HTMLDivElement;

  constructor() {
    super("CombatOverlay");
  }

  init(data: CombatOverlayData): void {
    this.data_ = data;
  }

  create(): void {
    const { x, y, width, height } = PLAY_AREA;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const dcx = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2;

    this.add
      .rectangle(cx, cy, width - scalePx(12), height - scalePx(12), 0x120a10, 0.94)
      .setDepth(0);

    const encounterLabel = createUiText(`Encounter: ${this.data_.enemy.id}`, {
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

    this.playTurns(0, this.data_.playerStartHp, this.data_.enemy.stats.hp, "");
  }

  /**
   * 002 FR-012: each turn line names the attacker, the damage dealt, and both
   * combatants' HP remaining after that turn.
   */
  private playTurns(index: number, playerHp: number, enemyHp: number, logSoFar: string): void {
    if (index >= this.data_.encounter.turns.length) {
      this.time.delayedCall(TURN_DELAY_MS, () => this.showOutcome());
      return;
    }
    const turn = this.data_.encounter.turns[index]!;
    if (turn.attacker === "player") {
      enemyHp = turn.defenderHpAfter;
    } else {
      playerHp = turn.defenderHpAfter;
    }
    const attackerLabel = turn.attacker === "player" ? "You" : this.data_.enemy.id;
    const line = `${attackerLabel} attack for ${turn.damageDealt} dmg — You: ${playerHp} HP | ${this.data_.enemy.id}: ${enemyHp} HP\n`;
    const nextLog = logSoFar + line;
    this.logText.textContent = nextLog;
    this.logText.scrollTop = this.logText.scrollHeight;
    this.time.delayedCall(TURN_DELAY_MS, () => this.playTurns(index + 1, playerHp, enemyHp, nextLog));
  }

  /** 002 FR-013: clearly presents the final outcome before resuming; 002 FR-015: logs the
   * encounter. bug fix: currency-not-logged — the enemy's currency drop (if any) is passed
   * through so it's folded into this same log entry. */
  private showOutcome(): void {
    const ctx = this.registry.get("ctx") as GameContext | undefined;
    ctx?.logCombatEncounter(this.data_.enemy.id, this.data_.encounter, this.data_.enemy.drops?.currency);

    const won = this.data_.encounter.winner === "player";
    this.outcomeText.textContent = won ? "Victory!" : "Defeat...";
    this.outcomeText.style.color = won ? "#8ecae6" : "#d1495b";
    this.outcomeText.style.display = "";

    this.time.delayedCall(TURN_DELAY_MS, () => this.data_.onComplete());
  }
}
