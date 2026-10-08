/* global HTMLElementTagNameMap */
import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { computeEffectiveStats, computeMaxHp } from "../../domain/character/combatStats";
import {
  BAG_CAPACITY,
  bagEntries,
  bagIsFull,
  bagSlotsUsed,
  canTakeOff,
  discard,
  equipFromBag,
  takeOff,
  type BagEntry,
  type GearSlot,
} from "../../domain/character/bag";
import { DOOR_KEY_TIERS } from "../../domain/character/types";
import { GRADES, type GradeId } from "../../domain/character/grades";
import { isLowHp } from "../sidePanel/hpState";
import { buildLootNameCatalog } from "../uiContent/itemDescriptions";
import {
  buildTooltipContent,
  gearInfo,
  type TooltipCatalogs,
  type TooltipContent,
  type TooltipSource,
} from "../sidePanel/tooltipContent";
import { formatBagFullEntry, formatDiscardEntry } from "../eventLog/formatEntry";
import { DESIGN_SIDE_PANEL_AREA } from "../gameConfig";
import { DESIGN_WIDTH, DESIGN_HEIGHT, DESIGN_UI_GUTTER } from "../scaleConfig";
import { getUiRoot, px } from "../ui/domOverlay";
import { attachMenuSounds } from "../sfx";
import type { FloorScene } from "./FloorScene";
import type { CombatOverlay } from "./CombatOverlay";
import { LOOT_TEXTURE_KEYS, KEY_TEXTURE_KEYS } from "./FloorScene";
import { spriteDataUrl } from "../render/spriteTextures";

const PLAYER_NAME = "The Prince";

/** Worn-gear slots in the order the panel lists them (033 C2). */
const SLOTS: { slot: GearSlot; label: string }[] = [
  { slot: "weapon", label: "Weapon" },
  { slot: "helm", label: "Helm" },
  { slot: "chest", label: "Chest" },
  { slot: "legs", label: "Legs" },
  { slot: "boots", label: "Boots" },
];

/** 034 FR-002a: a border glow in the item's grade colour. The fill is left alone; a selected bag
 * cell keeps its gold border. */
function glow(grade: GradeId, selected = false): Partial<CSSStyleDeclaration> {
  const colour = GRADES[grade].colour;
  return { borderColor: selected ? "var(--ui-gold)" : colour, boxShadow: `0 0 ${px(5)} ${px(1)} ${colour}` };
}

const TOOLTIP_WIDTH = 205;
const TOOLTIP_GAP = 8;

type Styles = Partial<CSSStyleDeclaration>;

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Styles,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

const iconCache = new Map<string, string>();
function iconSrc(key: string): string {
  let src = iconCache.get(key);
  if (!src) {
    src = spriteDataUrl(key);
    iconCache.set(key, src);
  }
  return src;
}

function entryId(e: BagEntry): string {
  return e.kind === "loot" ? `loot:${e.id}` : e.kind === "potion" ? "potion" : `gear:${e.index}`;
}

/**
 * 033 C2: the character sheet — header (pause, name, gold), HP bar, six stat tiles, five worn-gear
 * slots, the 25-slot bag with Use / Equip / Discard, and the key ring — plus the shared hover
 * tooltip (C3/C4). Rendered as a bordered DOM card in `#ui-root` (see ui/domOverlay.ts) so its text
 * stays sharp at any scale. Redraws only when the relevant state actually changes (a cheap
 * signature), so hover listeners aren't torn down every frame.
 */
export class SidePanelScene extends Phaser.Scene {
  private ctx!: GameContext;
  private catalogs!: TooltipCatalogs;
  private card!: HTMLDivElement;
  private tooltip!: HTMLDivElement;
  private lastSignature = "";
  private selectedId: string | null = null;

  constructor() {
    super("SidePanelScene");
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;
    this.catalogs = {
      weapons: this.ctx.weaponCatalog,
      armour: this.ctx.armorCatalog,
      lootNames: buildLootNameCatalog(this.ctx.tower),
      lootTextureKeys: LOOT_TEXTURE_KEYS,
      keyTextureKeys: KEY_TEXTURE_KEYS,
    };

    this.card = make("div", {
      left: px(DESIGN_SIDE_PANEL_AREA.x),
      top: px(DESIGN_SIDE_PANEL_AREA.y),
      width: px(DESIGN_SIDE_PANEL_AREA.width),
      height: px(DESIGN_SIDE_PANEL_AREA.height),
      display: "flex",
      flexDirection: "column",
    });
    this.card.className = "ui-card";
    this.card.dataset.testid = "side-panel";
    getUiRoot().appendChild(this.card);

    this.tooltip = make("div", {
      position: "absolute",
      width: px(TOOLTIP_WIDTH),
      pointerEvents: "none",
      zIndex: "5",
      display: "none",
    });
    this.tooltip.dataset.testid = "item-tooltip";
    getUiRoot().appendChild(this.tooltip);

    this.events.once("shutdown", () => {
      this.card.remove();
      this.tooltip.remove();
    });

    this.lastSignature = "";
    this.redraw();
  }

  override update(): void {
    // 033 C4: never leave a tooltip over a modal.
    if (this.isBusy()) this.hideTooltip();
    const signature = this.computeSignature();
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.redraw();
  }

  /** Combat, its intro, or the pause menu is up: the sheet is read-only (Use still works in battle). */
  private isBusy(): boolean {
    return (
      this.scene.isActive("CombatOverlay") ||
      this.scene.isActive("CombatIntroScene") || // 029 C8: the intro is part of the fight
      this.scene.isActive("PauseMenuScene")
    );
  }

  private overlay(): CombatOverlay | undefined {
    return this.scene.isActive("CombatOverlay") ? (this.scene.get("CombatOverlay") as CombatOverlay) : undefined;
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
      character.equippedRolls,
      character.bonusDamage,
      character.potionCount ?? 0, // 027 FR-050: refresh on pickup / drink / checkpoint restore
      character.bagGear ?? [],
      this.selectedId,
      this.isBusy(),
      this.overlay()?.canDrinkPotion() ?? false,
    ]);
  }

  // ---- tooltip (C3/C4) ----------------------------------------------------------------

  private hideTooltip(): void {
    this.tooltip.style.display = "none";
  }

  private showTooltip(target: HTMLElement, source: TooltipSource): void {
    if (this.isBusy()) return;
    const content = buildTooltipContent(this.ctx.save.character, source, this.catalogs);
    if (!content) return this.hideTooltip();
    this.fillTooltip(content);
    this.tooltip.style.visibility = "hidden";
    this.tooltip.style.display = "block";

    const rootRect = getUiRoot().getBoundingClientRect();
    const scale = rootRect.width / DESIGN_WIDTH; // CSS px per design unit
    const t = target.getBoundingClientRect();
    const height = this.tooltip.getBoundingClientRect().height / scale;
    const g = DESIGN_UI_GUTTER;
    const left = (t.left - rootRect.left) / scale - TOOLTIP_WIDTH - TOOLTIP_GAP;
    const top = Math.max(g, Math.min((t.top - rootRect.top) / scale - 6, DESIGN_HEIGHT - g - height));
    this.tooltip.style.left = px(Math.max(g, left));
    this.tooltip.style.top = px(top);
    this.tooltip.style.visibility = "visible";
  }

  private fillTooltip(c: TooltipContent): void {
    this.tooltip.replaceChildren();
    const card = make(
      "div",
      {
        background: "var(--ui-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: px(7),
        boxShadow: "0 10px 26px -6px rgba(0,0,0,0.7)",
        padding: `${px(9)} ${px(11)}`,
        display: "flex",
        flexDirection: "column",
        gap: px(7),
        color: "var(--ui-text)",
      },
      this.tooltip,
    );

    const head = make("div", { display: "flex", gap: px(8), alignItems: "center" }, card);
    const iconBox = make(
      "div",
      {
        width: px(32),
        height: px(32),
        borderRadius: px(5),
        background: "var(--ui-elev)",
        border: "1px solid var(--ui-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      },
      head,
    );
    if (c.iconKey) this.addIcon(iconBox, c.iconKey, 26);
    const titles = make("div", { display: "flex", flexDirection: "column", gap: px(1), minWidth: "0" }, head);
    make(
      "span",
      { fontSize: px(11), fontWeight: "700", ...(c.grade ? { color: GRADES[c.grade].colour } : {}) },
      titles,
      c.name,
    ).dataset.testid = "tooltip-name";
    make(
      "span",
      { fontSize: px(7.5), fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ui-gold)" },
      titles,
      c.kicker,
    );

    if (c.lines.length > 0) {
      const lines = make(
        "div",
        { display: "flex", flexDirection: "column", gap: px(4), borderTop: "1px solid var(--ui-soft)", paddingTop: px(7) },
        card,
      );
      for (const ln of c.lines) {
        const row = make("div", { display: "flex", alignItems: "baseline", gap: px(6) }, lines);
        row.dataset.testid = "tooltip-line";
        make("span", { flex: "1", fontSize: px(7.5), fontWeight: "700", color: "var(--ui-muted)" }, row, ln.label);
        make("span", { fontSize: px(9.5), fontWeight: "700" }, row, ln.value);
        if (ln.delta) {
          const d = make(
            "span",
            {
              minWidth: px(38),
              textAlign: "right",
              fontSize: px(9),
              fontWeight: "700",
              color: ln.delta.better ? "var(--ui-green)" : "var(--ui-red)",
            },
            row,
            ln.delta.text,
          );
          d.dataset.testid = "tooltip-delta";
          d.dataset.better = String(ln.delta.better);
        }
      }
    }
    if (c.description) {
      make(
        "div",
        { fontSize: px(9), color: "var(--ui-muted)", borderTop: "1px solid var(--ui-soft)", paddingTop: px(7), whiteSpace: "normal" },
        card,
        c.description,
      );
    }
    if (c.comparedWith) {
      make("div", { fontSize: px(8), color: "var(--ui-faint)", whiteSpace: "normal" }, card, c.comparedWith).dataset.testid =
        "tooltip-compared";
    }
    const hint = make(
      "div",
      {
        fontSize: px(8),
        fontWeight: "700",
        color: c.hintIsWarning ? "var(--ui-red)" : "var(--ui-gold)",
        borderTop: "1px dashed var(--ui-border)",
        paddingTop: px(6),
      },
      card,
      c.hint,
    );
    hint.dataset.testid = "tooltip-hint";
  }

  // ---- building blocks ----------------------------------------------------------------

  private addIcon(parent: HTMLElement, key: string, size: number): void {
    const img = make("img", { width: px(size), height: px(size), imageRendering: "pixelated" }, parent);
    img.src = iconSrc(key);
    img.draggable = false;
  }

  private hover(el: HTMLElement, source: TooltipSource | undefined): void {
    if (!source) return;
    el.addEventListener("mouseenter", () => this.showTooltip(el, source));
    el.addEventListener("mouseleave", () => this.hideTooltip());
  }

  private sectionLabel(text: string, right?: HTMLElement): HTMLElement {
    const row = make("div", { display: "flex", justifyContent: "space-between", alignItems: "baseline" }, this.card);
    make(
      "div",
      { fontSize: px(8), fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ui-faint)" },
      row,
      text,
    );
    if (right) row.appendChild(right);
    return row;
  }

  private iconKeyOfEntry(e: BagEntry): string | undefined {
    if (e.kind === "potion") return "potion";
    if (e.kind === "loot") return LOOT_TEXTURE_KEYS[e.id];
    return gearInfo(e.key, this.catalogs)?.iconKey;
  }

  private nameOfEntry(e: BagEntry): string {
    if (e.kind === "potion") return "Health potion";
    if (e.kind === "loot") return this.catalogs.lootNames.get(e.id) ?? e.id;
    return gearInfo(e.key, this.catalogs, e.item)?.name ?? e.key;
  }

  // ---- actions (US4 / C8) -------------------------------------------------------------

  private currentStats(): ReturnType<typeof computeEffectiveStats> {
    return computeEffectiveStats(this.ctx.save.character, this.ctx.weaponCatalog, this.ctx.armorCatalog);
  }

  private selectedEntry(entries: BagEntry[]): BagEntry | undefined {
    return entries.find((e) => entryId(e) === this.selectedId);
  }

  private commit(): void {
    this.selectedId = null;
    this.hideTooltip();
    this.ctx.persist();
  }

  private doEquip(entry: BagEntry): void {
    if (entry.kind !== "gear" || this.isBusy()) return;
    if (!gearInfo(entry.key, this.catalogs)) return;
    this.ctx.save.character = equipFromBag(this.ctx.save.character, entry.index);
    this.commit();
  }

  private doDiscard(entry: BagEntry): void {
    if (this.isBusy()) return;
    this.ctx.save.character = discard(this.ctx.save.character, entry);
    this.ctx.logEntry(formatDiscardEntry(this.nameOfEntry(entry)));
    this.commit();
  }

  private doUse(entry: BagEntry): void {
    const overlay = this.overlay();
    if (entry.kind !== "potion" || !overlay?.canDrinkPotion()) return;
    overlay.drinkPotion();
    this.selectedId = null;
  }

  private doTakeOff(slot: GearSlot): void {
    if (this.isBusy()) return;
    const character = this.ctx.save.character;
    const key = slot === "weapon" ? character.equippedWeaponId : character.equippedArmor[slot] && `${character.equippedArmor[slot]}:${slot}`;
    const info = key ? gearInfo(key, this.catalogs) : undefined;
    if (!info) return;
    if (!canTakeOff(character, slot)) {
      this.ctx.logEntry(formatBagFullEntry(info.name, "worn"));
      this.hideTooltip();
      return;
    }
    this.ctx.save.character = takeOff(character, slot);
    this.commit();
  }

  // ---- drawing ------------------------------------------------------------------------

  private redraw(): void {
    this.hideTooltip();
    this.card.replaceChildren();
    Object.assign(this.card.style, { padding: px(10), gap: px(10) });

    const { character } = this.ctx.save;
    const stats = this.currentStats();
    const maxHp = computeMaxHp(character);
    const entries = bagEntries(character);
    if (this.selectedId !== null && !this.selectedEntry(entries)) this.selectedId = null;
    const selected = this.selectedEntry(entries);

    this.drawHeader(character.currency);
    this.drawHp(character.currentHp, maxHp);
    this.drawStats(stats);
    this.sectionLabel("Equipped");
    this.drawSlots();
    this.drawBag(entries);
    this.drawActions(selected);
    this.drawKeys(character.keyIds);
  }

  private drawHeader(gold: number): void {
    const row = make("div", { display: "flex", alignItems: "center", gap: px(8) }, this.card);

    const pause = make(
      "button",
      {
        width: px(28),
        height: px(28),
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: px(3),
        padding: "0",
      },
      row,
    );
    pause.className = "ui-tile";
    pause.dataset.testid = "pause-button";
    pause.title = "Pause";
    for (let i = 0; i < 2; i++) make("span", { width: px(3.5), height: px(12), background: "var(--ui-text)", borderRadius: "1px" }, pause);
    pause.addEventListener("click", () => {
      if (this.isBusy()) return;
      (this.scene.get("FloorScene") as FloorScene).openPauseMenu();
    });
    attachMenuSounds(this, pause);

    make("div", { flex: "1", fontSize: px(18), fontWeight: "700", color: "var(--ui-gold)", letterSpacing: "0.03em" }, row, PLAYER_NAME).dataset.testid =
      "panel-name";
    const goldBox = make(
      "div",
      { display: "flex", alignItems: "center", gap: px(4), fontSize: px(14), fontWeight: "700", color: "var(--ui-gold)" },
      row,
    );
    goldBox.dataset.testid = "panel-gold";
    this.addIcon(goldBox, "coin", 16);
    goldBox.appendChild(document.createTextNode(String(gold)));
  }

  private drawHp(hp: number, maxHp: number): void {
    const wrap = make("div", { display: "flex", flexDirection: "column", gap: px(4) }, this.card);
    const labels = make(
      "div",
      { display: "flex", justifyContent: "space-between", fontSize: px(9), fontWeight: "700", color: "var(--ui-muted)" },
      wrap,
    );
    make("span", {}, labels, "HP");
    make("span", { color: isLowHp(hp, maxHp) ? "var(--ui-red)" : "var(--ui-muted)" }, labels, `${hp} / ${maxHp}`).dataset.testid =
      "panel-hp-text";
    const track = make("div", { height: px(8), background: "var(--ui-soft)", borderRadius: "999px", overflow: "hidden" }, wrap);
    const fill = make("div", { height: "100%", background: "var(--ui-red)", borderRadius: "999px" }, track);
    fill.style.width = `${Math.round((hp / Math.max(1, maxHp)) * 100)}%`;
    fill.dataset.testid = "panel-hp-bar";
  }

  private drawStats(stats: ReturnType<typeof computeEffectiveStats>): void {
    const grid = make("div", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: px(5) }, this.card);
    const tiles: [string, string, string][] = [
      ["stat-dmg", "DMG", String(stats.damage)],
      ["stat-def", "DEF", String(stats.defence)],
      ["stat-spd", "ATK SPD", `${(1 / stats.attackIntervalSec).toFixed(2)}/s`],
      ["stat-crit", "CRIT", `${Math.round(stats.critChance * 100)}%`],
      ["stat-critdmg", "CRIT DMG", `${Math.round((1.5 + stats.critDamageBonus) * 100)}%`],
      ["stat-dodge", "DODGE", `${Math.round(stats.dodgeChance * 100)}%`],
    ];
    for (const [id, label, value] of tiles) {
      const tile = make(
        "div",
        {
          background: "var(--ui-elev)",
          border: "1px solid var(--ui-soft)",
          borderRadius: px(7),
          padding: `${px(7)} ${px(9)}`,
          display: "flex",
          flexDirection: "column",
          gap: px(1),
        },
        grid,
      );
      make("span", { fontSize: px(7), fontWeight: "700", letterSpacing: "0.06em", color: "var(--ui-muted)" }, tile, label);
      make("span", { fontSize: px(16), fontWeight: "700", color: "var(--ui-gold)", lineHeight: "1" }, tile, value).dataset.testid = id;
    }
  }

  private drawSlots(): void {
    const list = make("div", { display: "flex", flexDirection: "column", gap: px(4) }, this.card);
    const character = this.ctx.save.character;
    for (const { slot, label } of SLOTS) {
      const key =
        slot === "weapon"
          ? character.equippedWeaponId
          : character.equippedArmor[slot]
            ? `${character.equippedArmor[slot]}:${slot}`
            : undefined;
      const info = key ? gearInfo(key, this.catalogs, character.equippedRolls?.[slot]) : undefined;

      const btn = make(
        "button",
        {
          display: "flex",
          alignItems: "center",
          gap: px(8),
          textAlign: "left",
          padding: `${px(3)} ${px(8)} ${px(3)} ${px(3)}`,
          borderStyle: info ? "solid" : "dashed",
          // 034 FR-002a: a border glow in the grade colour; the slot fill is untouched.
          ...(info ? glow(info.grade) : {}),
        },
        list,
      );
      btn.className = "ui-tile";
      btn.dataset.testid = `slot-${slot}`;
      const iconBox = make(
        "div",
        { width: px(32), height: px(32), borderRadius: px(6), background: "var(--ui-card)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" },
        btn,
      );
      if (info) this.addIcon(iconBox, info.iconKey, 28);
      const text = make("div", { flex: "1", minWidth: "0", display: "flex", flexDirection: "column" }, btn);
      make("span", { fontSize: px(7), fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ui-faint)" }, text, label);
      make(
        "span",
        {
          fontSize: px(9.5),
          fontWeight: "700",
          color: info ? GRADES[info.grade].colour : "var(--ui-faint)", // 034 FR-002b
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
        text,
        info ? info.name : "Empty",
      ).dataset.testid = `slot-${slot}-name`;
      if (info) {
        btn.addEventListener("click", () => this.doTakeOff(slot));
        this.hover(btn, { from: "slot", slot });
      }
    }
  }

  private drawBag(entries: BagEntry[]): void {
    const used = bagSlotsUsed(this.ctx.save.character);
    const full = bagIsFull(this.ctx.save.character);
    const count = make(
      "span",
      { fontSize: px(8), fontWeight: "700", color: full ? "var(--ui-red)" : "var(--ui-faint)" },
      undefined,
      `${used} / ${BAG_CAPACITY}${full ? " · Full" : ""}`,
    );
    count.dataset.testid = "bag-count";
    this.sectionLabel("Bag", count);

    const cells = Math.max(BAG_CAPACITY, Math.ceil(entries.length / 5) * 5);
    // FR-016c: an old save can hold more than 25 entries; the grid then scrolls instead of pushing
    // the key ring out of the card. Five rows of square cells plus gaps = 226 design units.
    const scroller = make("div", { maxHeight: px(226), overflowY: "auto", scrollbarWidth: "thin", flex: "none" }, this.card);
    scroller.dataset.testid = "bag-grid";
    const grid = make("div", { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: px(4) }, scroller);
    for (let i = 0; i < cells; i++) {
      const entry = entries[i];
      const on = entry !== undefined && entryId(entry) === this.selectedId;
      const cell = make(
        "button",
        {
          aspectRatio: "1 / 1",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          borderStyle: entry ? "solid" : "dashed",
          borderColor: on ? "var(--ui-gold)" : "var(--ui-soft)",
          background: on ? "var(--ui-gold-wash)" : entry ? "var(--ui-elev)" : "transparent",
          ...(entry?.kind === "gear" ? glow(entry.item.grade, on) : {}),
        },
        grid,
      );
      cell.className = "ui-tile";
      cell.dataset.testid = `bag-cell-${i}`;
      if (!entry) {
        cell.disabled = true;
        continue;
      }
      const key = this.iconKeyOfEntry(entry);
      if (key) this.addIcon(cell, key, 24);
      else make("div", { width: px(18), height: px(18), background: "var(--ui-gold)", borderRadius: "3px" }, cell);
      const qty = entry.kind === "gear" ? 1 : entry.qty;
      if (qty > 1) {
        make("span", { position: "absolute", right: px(3), bottom: px(1), fontSize: px(8), fontWeight: "700" }, cell, `×${qty}`);
      }
      cell.addEventListener("click", () => {
        this.selectedId = this.selectedId === entryId(entry) ? null : entryId(entry);
        this.lastSignature = "";
      });
      const source: TooltipSource = { from: "bag", entry };
      this.hover(cell, source);
    }
  }

  private drawActions(selected: BagEntry | undefined): void {
    const row = make("div", { display: "flex", gap: px(6) }, this.card);
    const busy = this.isBusy();
    const buttons: [string, string, boolean, () => void][] = [
      ["bag-use", "Use", selected?.kind === "potion" && (this.overlay()?.canDrinkPotion() ?? false), () => selected && this.doUse(selected)],
      ["bag-equip", "Equip", selected?.kind === "gear" && !busy, () => selected && this.doEquip(selected)],
      ["bag-discard", "Discard", selected !== undefined && !busy, () => selected && this.doDiscard(selected)],
    ];
    for (const [id, label, enabled, action] of buttons) {
      const b = make(
        "button",
        {
          flex: "1",
          padding: `${px(6)} 0`,
          fontSize: px(9),
          fontWeight: "700",
          opacity: enabled ? "1" : "0.4",
          background: enabled && id !== "bag-discard" ? "var(--ui-gold)" : "var(--ui-elev)",
          color: enabled && id !== "bag-discard" ? "#1a1206" : "var(--ui-text)",
        },
        row,
        label,
      );
      b.className = "ui-tile";
      b.dataset.testid = id;
      b.disabled = !enabled;
      b.addEventListener("click", action);
      attachMenuSounds(this, b);
    }
  }

  private drawKeys(keyIds: string[]): void {
    const wrap = make(
      "div",
      {
        marginTop: "auto",
        marginLeft: px(-10),
        marginRight: px(-10),
        marginBottom: px(-10),
        padding: `${px(8)} ${px(10)} ${px(10)}`,
        background: "var(--ui-elev)",
        borderTop: "1px solid var(--ui-soft)",
        display: "flex",
        flexDirection: "column",
        gap: px(6),
      },
      this.card,
    );
    const header = make("div", { display: "flex", justifyContent: "space-between", alignItems: "baseline" }, wrap);
    make("span", { fontSize: px(8), fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ui-faint)" }, header, "Key ring");
    make("span", { fontSize: px(8), fontWeight: "700", color: "var(--ui-faint)" }, header, `${keyIds.length} ${keyIds.length === 1 ? "key" : "keys"}`).dataset.testid =
      "key-total";
    const grid = make("div", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: px(5) }, wrap);
    for (const tier of DOOR_KEY_TIERS) {
      const count = keyIds.filter((k) => k === tier).length;
      const tile = make(
        "div",
        {
          display: "flex",
          alignItems: "center",
          gap: px(5),
          background: "var(--ui-card)",
          border: `1px ${count ? "solid" : "dashed"} ${count ? "var(--ui-border)" : "var(--ui-soft)"}`,
          borderRadius: px(7),
          padding: `${px(2)} ${px(5)} ${px(2)} ${px(2)}`,
        },
        grid,
      );
      tile.dataset.testid = `key-${tier}`;
      tile.dataset.count = String(count);
      const iconBox = make(
        "div",
        { width: px(24), height: px(24), borderRadius: px(5), background: "var(--ui-elev)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", opacity: count ? "1" : "0.3" },
        tile,
      );
      const textureKey = KEY_TEXTURE_KEYS[tier];
      if (textureKey) this.addIcon(iconBox, textureKey, 20);
      const text = make("div", { display: "flex", flexDirection: "column", minWidth: "0" }, tile);
      make("span", { fontSize: px(7), fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ui-faint)" }, text, tier);
      make("span", { fontSize: px(13), fontWeight: "700", lineHeight: "1", color: count ? "var(--ui-gold)" : "var(--ui-locked)" }, text, `×${count}`);
      this.hover(tile, { from: "key", keyType: tier, count });
    }
  }
}
