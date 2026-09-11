import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { computeEffectiveStats, computeMaxHp } from "../../domain/character/powerups";
import { isLowHp } from "../sidePanel/hpState";
import {
  lootDescriptions,
  keyTypeDescriptions,
  buildLootNameCatalog,
} from "../uiContent/itemDescriptions";
import { SIDE_PANEL_AREA, DESIGN_SIDE_PANEL_AREA } from "../gameConfig";
import { getUiRoot, px } from "../ui/domOverlay";
import type { FloorScene } from "./FloorScene";

/** Height reserved at the top of the side panel for the pause control (design-space units). */
const PAUSE_BUTTON_AREA_HEIGHT = 20;

/**
 * 002 FR-001–FR-006: a full-height, right-hand side panel showing the player's current
 * stats and every individually collected loot item, powerup, and held key type, with
 * hover tooltips (the browser's own native title-attribute tooltip). Replaces the base
 * game's HudOverlay entirely. Redraws only when the relevant state actually changes
 * (tracked via a cheap signature), so pointer hover listeners aren't torn down every frame.
 * Renders as a real, natively-scrollable DOM panel (see ui/domOverlay.ts) rather than
 * Phaser Text objects, so its text stays sharp regardless of canvas scaling
 * (specs/bugs/ui-text-dom-overlay) — this also means scrolling is native browser
 * scrolling (002 FR-003 / converge T040) instead of hand-rolled offset math.
 */
export class SidePanelScene extends Phaser.Scene {
  private ctx!: GameContext;
  private lootNameCatalog!: ReadonlyMap<string, string>;
  private lastSignature = "";
  private rows!: HTMLDivElement;

  constructor() {
    super("SidePanelScene");
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;
    this.lootNameCatalog = buildLootNameCatalog(this.ctx.tower);

    this.add
      .rectangle(
        SIDE_PANEL_AREA.x,
        SIDE_PANEL_AREA.y,
        SIDE_PANEL_AREA.width,
        SIDE_PANEL_AREA.height,
        0x120a10,
      )
      .setOrigin(0, 0)
      .setDepth(15);

    this.rows = document.createElement("div");
    this.rows.dataset.testid = "side-panel-rows";
    this.rows.style.position = "absolute";
    this.rows.style.left = px(DESIGN_SIDE_PANEL_AREA.x);
    this.rows.style.top = px(DESIGN_SIDE_PANEL_AREA.y + PAUSE_BUTTON_AREA_HEIGHT);
    this.rows.style.width = px(DESIGN_SIDE_PANEL_AREA.width);
    this.rows.style.height = px(DESIGN_SIDE_PANEL_AREA.height - PAUSE_BUTTON_AREA_HEIGHT);
    this.rows.style.padding = px(6);
    this.rows.style.overflowY = "auto";
    this.rows.style.pointerEvents = "auto";
    getUiRoot().appendChild(this.rows);
    this.events.once("shutdown", () => this.rows.remove());

    const pauseButton = document.createElement("button");
    pauseButton.dataset.testid = "pause-button";
    pauseButton.title = "Pause";
    pauseButton.className = "ui-menu-option";
    pauseButton.style.position = "absolute";
    pauseButton.style.left = px(DESIGN_SIDE_PANEL_AREA.x + 6);
    pauseButton.style.top = px(DESIGN_SIDE_PANEL_AREA.y + 4);
    pauseButton.style.width = px(12);
    pauseButton.style.height = px(10);
    for (const barLeft of [0, 6]) {
      const bar = document.createElement("span");
      bar.style.position = "absolute";
      bar.style.left = px(barLeft);
      bar.style.top = "0";
      bar.style.width = px(4);
      bar.style.height = px(10);
      bar.style.background = "#e0c9a6";
      pauseButton.appendChild(bar);
    }
    pauseButton.addEventListener("click", () => {
      if (
        this.scene.isActive("CombatOverlay") ||
        this.scene.isActive("PickupModalScene") ||
        this.scene.isActive("PauseMenuScene")
      ) {
        return;
      }
      (this.scene.get("FloorScene") as FloorScene).openPauseMenu();
    });
    getUiRoot().appendChild(pauseButton);
    this.events.once("shutdown", () => pauseButton.remove());

    this.lastSignature = "";
    this.redraw();
  }

  override update(): void {
    const signature = this.computeSignature();
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.redraw();
  }

  private computeSignature(): string {
    const { character } = this.ctx.save;
    const stats = computeEffectiveStats(character, this.ctx.powerupCatalog);
    return JSON.stringify([
      character.currentHp,
      stats.damage,
      stats.defence,
      character.currency,
      character.inventory,
      character.powerupIds,
      character.keyIds,
    ]);
  }

  private addRow(label: string, tooltipText: string, color = "#e0c9a6"): void {
    const row = document.createElement("div");
    row.textContent = label;
    row.style.color = color;
    row.style.fontSize = px(8);
    row.style.marginBottom = px(4);
    row.style.whiteSpace = "pre";
    if (tooltipText) row.title = tooltipText;
    this.rows.appendChild(row);
  }

  private redraw(): void {
    const scrollTop = this.rows.scrollTop;
    this.rows.replaceChildren();

    const { character } = this.ctx.save;
    const stats = computeEffectiveStats(character, this.ctx.powerupCatalog);
    const maxHp = computeMaxHp(character, this.ctx.powerupCatalog);
    const low = isLowHp(character.currentHp, maxHp);

    this.addRow("Player", "Your character.", "#8ecae6");
    this.addRow(
      `HP: ${character.currentHp}/${maxHp}`,
      "Current and maximum health points. Reaching 0 from a hazard is fatal.",
      low ? "#ff6b6b" : "#e0c9a6",
    );
    this.addRow(`Dmg: ${stats.damage}`, "Damage dealt per successful attack.");
    this.addRow(`Def: ${stats.defence}`, "Reduces incoming damage per attack.");
    this.addRow(`Gold: ${character.currency}`, "Currency collected so far this playthrough.");

    this.addRow("Items:", "Loot collected on floors.", "#8ecae6");
    if (character.inventory.length === 0) {
      this.addRow("  (none)", "No loot collected yet.");
    } else {
      for (const lootId of character.inventory) {
        const name = this.lootNameCatalog.get(lootId) ?? lootId;
        const description = lootDescriptions[lootId] ?? "";
        this.addRow(`  ${name}`, description);
      }
    }

    this.addRow("Powerups:", "Lasting stat bonuses collected.", "#8ecae6");
    if (character.powerupIds.length === 0) {
      this.addRow("  (none)", "No powerups collected yet.");
    } else {
      for (const powerupId of character.powerupIds) {
        const powerup = this.ctx.powerupCatalog.get(powerupId);
        this.addRow(`  ${powerupId}`, powerup?.description ?? "");
      }
    }

    this.addRow("Keys:", "Keys held for matching keyed doors.", "#8ecae6");
    if (character.keyIds.length === 0) {
      this.addRow("  (none)", "No keys held yet.");
    } else {
      for (const keyType of character.keyIds) {
        const description = keyTypeDescriptions[keyType] ?? "";
        this.addRow(`  ${keyType} key`, description);
      }
    }

    // 002 FR-003 (converge T040): re-clamp scroll now the list may have grown/shrunk,
    // so every collected item stays reachable rather than sliding permanently off-canvas.
    // Native overflow scrolling clamps scrollTop to the content's own bounds automatically.
    this.rows.scrollTop = scrollTop;
  }
}
