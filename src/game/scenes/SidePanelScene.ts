import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { computeEffectiveStats, computeMaxHp } from "../../domain/character/combatStats";
import { isLowHp } from "../sidePanel/hpState";
import {
  lootDescriptions,
  keyTypeDescriptions,
  armorSlotDescriptions,
  buildLootNameCatalog,
} from "../uiContent/itemDescriptions";
import type { ArmorSlotId } from "../../domain/character/types";
import { SIDE_PANEL_AREA, DESIGN_SIDE_PANEL_AREA } from "../gameConfig";
import { getUiRoot, px } from "../ui/domOverlay";
import { attachMenuSounds } from "../sfx";
import type { FloorScene } from "./FloorScene";
import { COLORS, LOOT_TEXTURE_KEYS, KEY_TEXTURE_KEYS } from "./FloorScene";
import { spriteDataUrl } from "../render/spriteTextures";

/** Height reserved at the top of the side panel for the pause control (design-space units). */
const PAUSE_BUTTON_AREA_HEIGHT = 20;

/** Converts a Phaser-style numeric hex color (e.g. COLORS.loot = 0xe9c46a) to a CSS color
 * string, so the DOM-rendered fallback icon (009 FR-007) can reuse FloorScene's exact colors. */
function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/**
 * 002 FR-001–FR-006: a full-height, right-hand side panel showing the player's current
 * stats and every individually collected loot item and held key type, with hover
 * tooltips (the browser's own native title-attribute tooltip). Replaces the base
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
      if (this.scene.isActive("CombatOverlay") || this.scene.isActive("PauseMenuScene")) {
        return;
      }
      (this.scene.get("FloorScene") as FloorScene).openPauseMenu();
    });
    attachMenuSounds(this, pauseButton);
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
    const stats = computeEffectiveStats(character, this.ctx.weaponCatalog, this.ctx.armorCatalog);
    return JSON.stringify([
      character.currentHp,
      stats.damage,
      stats.defence,
      character.currency,
      character.inventory,
      character.keyIds,
      character.equippedWeaponId,
      character.equippedArmor,
      character.bonusDamage,
      character.potionCount ?? 0, // 027 FR-050: refresh on pickup / drink / checkpoint restore
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

  /** 009: a single item icon — either real art (`src`) or, when none is baked yet, a plain
   * colored square (`fallbackColor`, reusing FloorScene's own COLORS.loot/COLORS.key so the
   * fallback never drifts from the floor map's, FR-007) — with the existing native-tooltip
   * mechanism (`title`) and an optional bottom-right quantity badge. A loot/key badge only
   * renders at count >= 2 (FR-011); passing `alwaysShow: true` (used by the gold row, FR-003)
   * renders the badge at any count, including 0 or 1 — 2026-09-16 clarification. */
  private buildIconEl(
    icon: { src: string } | { fallbackColor: string },
    tooltipText: string,
    badge?: { count: number; alwaysShow?: boolean },
  ): HTMLDivElement {
    const ICON_SIZE = 14;
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = px(ICON_SIZE);
    wrapper.style.height = px(ICON_SIZE);
    wrapper.style.flex = "none";
    if (tooltipText) wrapper.title = tooltipText;

    if ("src" in icon) {
      const img = document.createElement("img");
      img.src = icon.src;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.imageRendering = "pixelated";
      wrapper.appendChild(img);
    } else {
      const swatch = document.createElement("div");
      swatch.style.width = "100%";
      swatch.style.height = "100%";
      swatch.style.background = icon.fallbackColor;
      wrapper.appendChild(swatch);
    }

    if (badge !== undefined && (badge.alwaysShow || badge.count >= 2)) {
      const badgeEl = document.createElement("span");
      badgeEl.textContent = String(badge.count);
      badgeEl.style.position = "absolute";
      badgeEl.style.right = "0";
      badgeEl.style.bottom = "0";
      badgeEl.style.fontSize = px(6);
      badgeEl.style.lineHeight = "1";
      badgeEl.style.color = "#e0c9a6";
      badgeEl.style.background = "#120a10";
      wrapper.appendChild(badgeEl);
    }

    return wrapper;
  }

  /** 009: a single-value row (Weapon/Armor/Gold) rendered as an icon, replacing the old text
   * line for that row (FR-001/FR-002/FR-003) — Gold passes a badge (see buildIconEl). */
  private addIconRow(
    icon: { src: string } | { fallbackColor: string },
    tooltipText: string,
    badge?: { count: number; alwaysShow?: boolean },
  ): void {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = px(3);
    row.style.marginBottom = px(4);
    row.appendChild(this.buildIconEl(icon, tooltipText, badge));
    this.rows.appendChild(row);
  }

  /** 009: the Items:/Keys: categories — a wrapping icon grid (one icon per distinct id/type,
   * FR-004/FR-005) instead of one text line per unit. */
  private addIconGrid(
    entries: { icon: { src: string } | { fallbackColor: string }; tooltipText: string; count: number }[],
  ): void {
    const grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = px(3);
    grid.style.marginBottom = px(4);
    for (const entry of entries) {
      grid.appendChild(this.buildIconEl(entry.icon, entry.tooltipText, { count: entry.count }));
    }
    this.rows.appendChild(grid);
  }

  private redraw(): void {
    const scrollTop = this.rows.scrollTop;
    this.rows.replaceChildren();

    const { character } = this.ctx.save;
    const stats = computeEffectiveStats(character, this.ctx.weaponCatalog, this.ctx.armorCatalog);
    const maxHp = computeMaxHp(character);
    const low = isLowHp(character.currentHp, maxHp);
    const weapon = character.equippedWeaponId ? this.ctx.weaponCatalog.get(character.equippedWeaponId) : undefined;

    this.addRow("Player", "Your character.", "#8ecae6");
    this.addRow(
      `HP: ${character.currentHp}/${maxHp}`,
      "Current and maximum health points. Reaching 0 from a hazard is fatal.",
      low ? "#ff6b6b" : "#e0c9a6",
    );
    this.addRow(`Dmg: ${stats.damage}`, "Damage dealt per successful attack.");
    this.addRow(`Def: ${stats.defence}`, "Reduces incoming damage per attack.");
    if (weapon) {
      this.addIconRow({ src: spriteDataUrl(weapon.textureKey) }, `${weapon.name}: Determines damage dealt in combat.`);
    } else {
      this.addRow("Weapon: (unarmed)", "Determines damage dealt in combat.");
    }
    const ARMOR_SLOT_LABELS: Record<ArmorSlotId, string> = {
      helm: "Helm",
      chest: "Chest",
      legs: "Legs",
      boots: "Boots",
    };
    this.addRow("Equipment:", "Armor equipped per slot: Helm, Chest, Legs, Boots.", "#8ecae6");
    this.addIconGrid(
      (Object.keys(ARMOR_SLOT_LABELS) as ArmorSlotId[]).map((slot) => {
        const material = character.equippedArmor[slot];
        const piece = material ? this.ctx.armorCatalog.get(`${material}:${slot}`) : undefined;
        return piece
          ? {
              icon: { src: spriteDataUrl(piece.textureKey) },
              tooltipText: `${piece.name}: ${armorSlotDescriptions[slot]}`,
              count: 1,
            }
          : {
              icon: { fallbackColor: "#3a3040" },
              tooltipText: `${ARMOR_SLOT_LABELS[slot]}: (none) — ${armorSlotDescriptions[slot]}`,
              count: 1,
            };
      }),
    );
    this.addIconRow(
      { src: spriteDataUrl("coin") },
      `${character.currency} gold: Currency collected so far this playthrough.`,
      { count: character.currency, alwaysShow: true },
    );
    // 027 FR-050 (contract C18): carried health potions, so the player knows before engaging.
    const potions = character.potionCount ?? 0;
    this.addIconRow(
      { src: spriteDataUrl("potion") },
      `${potions} health potion${potions === 1 ? "" : "s"}: Carried; drink one in battle to heal 25% of max HP.`,
      { count: potions, alwaysShow: true },
    );

    this.addRow("Items:", "Loot collected on floors.", "#8ecae6");
    const inventoryTally = new Map<string, number>();
    for (const lootId of character.inventory) {
      inventoryTally.set(lootId, (inventoryTally.get(lootId) ?? 0) + 1);
    }
    if (inventoryTally.size === 0) {
      this.addRow("  (none)", "No loot collected yet.");
    } else {
      this.addIconGrid(
        [...inventoryTally.entries()].map(([lootId, count]) => {
          const name = this.lootNameCatalog.get(lootId) ?? lootId;
          const description = lootDescriptions[lootId] ?? "";
          const textureKey = LOOT_TEXTURE_KEYS[lootId];
          return {
            icon: textureKey ? { src: spriteDataUrl(textureKey) } : { fallbackColor: hexColor(COLORS.loot) },
            tooltipText: `${name}: ${description}`,
            count,
          };
        }),
      );
    }

    this.addRow("Keys:", "Keys held for matching keyed doors.", "#8ecae6");
    const keyTally = new Map<string, number>();
    for (const keyType of character.keyIds) {
      keyTally.set(keyType, (keyTally.get(keyType) ?? 0) + 1);
    }
    if (keyTally.size === 0) {
      this.addRow("  (none)", "No keys held yet.");
    } else {
      this.addIconGrid(
        [...keyTally.entries()].map(([keyType, count]) => {
          const description = keyTypeDescriptions[keyType] ?? "";
          const textureKey = KEY_TEXTURE_KEYS[keyType];
          return {
            icon: textureKey ? { src: spriteDataUrl(textureKey) } : { fallbackColor: hexColor(COLORS.key) },
            tooltipText: `${keyType} key: ${description}`,
            count,
          };
        }),
      );
    }

    // 002 FR-003 (converge T040): re-clamp scroll now the list may have grown/shrunk,
    // so every collected item stays reachable rather than sliding permanently off-canvas.
    // Native overflow scrolling clamps scrollTop to the content's own bounds automatically.
    this.rows.scrollTop = scrollTop;
  }
}
