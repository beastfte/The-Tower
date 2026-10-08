import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import type { EventLogKind } from "../eventLog/types";
import { DESIGN_EVENT_LOG_AREA } from "../gameConfig";
import { DESIGN_WIDTH } from "../scaleConfig";
import { getUiRoot, px } from "../ui/domOverlay";

/** 033 C6 / FR-013: the dot colour for each entry kind. */
const KIND_COLOR: Record<EventLogKind, string> = {
  combat: "var(--ui-red)",
  pickup: "var(--ui-gold)",
  purchase: "var(--ui-gold)",
  gear: "var(--ui-green)",
  note: "var(--ui-muted)",
};

/** Within this many design units of the bottom counts as "following the newest entry". */
const FOLLOW_SLACK = 2;

/**
 * 002 FR-015–FR-017, 033 C6: an always-visible bordered card with a titled header and one row per
 * session event — a type-coloured dot and the message, newest in bold. A native scrolling list that
 * keeps following the newest entry, but stays put while the player has scrolled back.
 */
export class EventLogScene extends Phaser.Scene {
  private ctx!: GameContext;
  private card!: HTMLDivElement;
  private list!: HTMLDivElement;
  private rendered = 0;
  private emptyRow: HTMLElement | undefined;
  private newestRow: HTMLElement | undefined;

  constructor() {
    super("EventLogScene");
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;

    this.card = document.createElement("div");
    this.card.className = "ui-card";
    this.card.dataset.testid = "event-log";
    Object.assign(this.card.style, {
      left: px(DESIGN_EVENT_LOG_AREA.x),
      top: px(DESIGN_EVENT_LOG_AREA.y),
      width: px(DESIGN_EVENT_LOG_AREA.width),
      height: px(DESIGN_EVENT_LOG_AREA.height),
      display: "flex",
      flexDirection: "column",
      borderWidth: "2px",
      background: "var(--ui-elev)",
    });

    const header = document.createElement("div");
    header.textContent = "Event log";
    Object.assign(header.style, {
      padding: `${px(7)} ${px(14)}`,
      background: "var(--ui-card)",
      borderBottom: "1px solid var(--ui-border)",
      fontSize: px(9),
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ui-gold)",
    });
    this.card.appendChild(header);

    this.list = document.createElement("div");
    this.list.dataset.testid = "event-log-list";
    Object.assign(this.list.style, {
      flex: "1",
      minHeight: "0",
      overflowY: "auto",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--ui-border) transparent",
      padding: `${px(3)} 0`,
    });
    this.card.appendChild(this.list);

    getUiRoot().appendChild(this.card);
    this.events.once("shutdown", () => this.card.remove());

    this.rendered = 0;
    this.newestRow = undefined;
    this.emptyRow = undefined;
    this.redraw();
    this.list.scrollTop = this.list.scrollHeight;
  }

  override update(): void {
    if (this.ctx.eventLog.length === this.rendered) return;
    this.redraw();
  }

  private makeRow(kind: EventLogKind, message: string): HTMLDivElement {
    const row = document.createElement("div");
    row.dataset.testid = "event-log-row";
    row.dataset.kind = kind;
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: px(9),
      padding: `${px(3)} ${px(14)}`,
      fontSize: px(10),
    });
    const dot = document.createElement("span");
    Object.assign(dot.style, {
      width: px(6),
      height: px(6),
      borderRadius: "50%",
      background: KIND_COLOR[kind],
      flex: "none",
    });
    const text = document.createElement("span");
    text.textContent = message;
    row.append(dot, text);
    return row;
  }

  private redraw(): void {
    const log = this.ctx.eventLog;
    const scale = getUiRoot().getBoundingClientRect().width / DESIGN_WIDTH;
    const atBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight <= FOLLOW_SLACK * scale;

    if (log.length === 0) {
      if (!this.emptyRow) {
        this.emptyRow = document.createElement("div");
        this.emptyRow.textContent = "(no events yet)";
        Object.assign(this.emptyRow.style, { padding: `${px(3)} ${px(14)}`, fontSize: px(10), color: "var(--ui-faint)" });
        this.list.appendChild(this.emptyRow);
      }
      this.rendered = 0;
      return;
    }
    this.emptyRow?.remove();
    this.emptyRow = undefined;

    for (let i = this.rendered; i < log.length; i++) {
      if (this.newestRow) this.newestRow.style.fontWeight = "400";
      const entry = log[i]!;
      this.newestRow = this.makeRow(entry.kind, entry.message);
      this.newestRow.style.fontWeight = "700";
      this.list.appendChild(this.newestRow);
    }
    this.rendered = log.length;
    if (atBottom) this.list.scrollTop = this.list.scrollHeight;
  }
}
