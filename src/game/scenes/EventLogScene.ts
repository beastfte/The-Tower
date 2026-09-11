import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { EVENT_LOG_AREA, DESIGN_EVENT_LOG_AREA } from "../gameConfig";
import { createUiText, getUiRoot, px } from "../ui/domOverlay";

const MAX_VISIBLE_LINES = 4;

/**
 * 002 FR-015–FR-017: an always-visible, dedicated-area log of combat outcomes and
 * key/powerup pickups, in chronological order, for the current browser session only.
 * Shows the most recent entries (scrolled to the bottom) since the log is not capped.
 */
export class EventLogScene extends Phaser.Scene {
  private ctx!: GameContext;
  private text!: HTMLDivElement;
  private lastLength = -1;
  /** 002 US5 Edge Cases / converge T041: entries hidden below the visible window because
   * the player scrolled back; 0 = following the most recent entry. */
  private scrollOffset = 0;

  constructor() {
    super("EventLogScene");
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;

    this.add
      .rectangle(
        EVENT_LOG_AREA.x,
        EVENT_LOG_AREA.y,
        EVENT_LOG_AREA.width,
        EVENT_LOG_AREA.height,
        0x0d0a0f,
      )
      .setOrigin(0, 0)
      .setDepth(15);

    this.text = createUiText("", {
      x: DESIGN_EVENT_LOG_AREA.x + 4,
      y: DESIGN_EVENT_LOG_AREA.y + 4,
      originX: 0,
      originY: 0,
      fontSize: 8,
      color: "#c9bba0",
      maxWidth: DESIGN_EVENT_LOG_AREA.width - 8,
    });
    this.text.dataset.testid = "event-log-text";
    // Explicit height (not just auto-sized to content) so the whole event-log area is
    // wheel-responsive even when there are only a few short lines of text.
    this.text.style.height = px(DESIGN_EVENT_LOG_AREA.height - 8);
    // The event log area itself must receive wheel events (it sits in front of the canvas
    // in the DOM overlay, which is pointer-events:none by default — see ui/domOverlay.ts).
    this.text.style.pointerEvents = "auto";
    getUiRoot().appendChild(this.text);
    this.events.once("shutdown", () => this.text.remove());

    // 002 US5 Edge Cases / converge T041: lets the player scroll back to reach entries
    // older than the visible window, per spec.md's Assumption that the log "remains
    // scrollable to reach older entries as it grows".
    this.text.addEventListener("wheel", (event: WheelEvent) => {
      event.preventDefault();
      const maxOffset = Math.max(0, this.ctx.eventLog.length - MAX_VISIBLE_LINES);
      // Scrolling up (deltaY < 0) reveals older entries (increase offset); scrolling down
      // (deltaY > 0) moves back toward the most recent entry (decrease offset toward 0).
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + (event.deltaY > 0 ? -1 : 1),
        0,
        maxOffset,
      );
      this.redraw();
    });

    this.lastLength = -1;
    this.redraw();
  }

  override update(): void {
    if (this.ctx.eventLog.length === this.lastLength) return;
    this.lastLength = this.ctx.eventLog.length;
    this.redraw();
  }

  private redraw(): void {
    const total = this.ctx.eventLog.length;
    const maxOffset = Math.max(0, total - MAX_VISIBLE_LINES);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, maxOffset);

    const end = total - this.scrollOffset;
    const start = Math.max(0, end - MAX_VISIBLE_LINES);
    const entries = this.ctx.eventLog.slice(start, end);

    if (entries.length === 0) {
      this.text.textContent = "(no events yet)";
      return;
    }
    const lines = entries.map((e) => e.message);
    if (this.scrollOffset > 0) {
      lines.push(`(scrolled — ${this.scrollOffset} newer hidden, scroll down to catch up)`);
    }
    this.text.textContent = lines.join("\n");
  }
}
