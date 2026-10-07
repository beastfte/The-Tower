import Phaser from "phaser";
import {
  advanceBattle,
  drinkPotion,
  flee,
  startBattle,
  type BattleEvent,
  type BattleState,
  type CombatantStats,
  type Side,
} from "../../domain/combat/battle";
import type { BattleEndOutcome, BattleEndResult } from "../battleResult";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { RENDER_SCALE } from "../scaleConfig";
import { createUiText, getUiRoot, px } from "../ui/domOverlay";
import { createMenuOption } from "../ui/MenuOption";
import {
  attachMenuSounds,
  battleEventToSfxKey,
  battleOutcomeToSfxKey,
  playSfx,
  sfxPotion,
} from "../sfx";
import { computeMonsterAttackFrame, MONSTER_ATTACK_IMPACT_MS, type MonsterCombatFrame } from "../monsterAnimation";
import { computePlayerAttackFrame, type PlayerAttackFrame } from "../playerAnimation";
import { ensureMonsterCombatTexture, ensurePlayerTexture, hasMonsterCombatFrames } from "../render/spriteTextures";
import type { ArmourTierId } from "../render/spriteData";
import type { WeaponId } from "../../domain/character/types";

type HitEvent = Extract<BattleEvent, { kind: "hit" }>;
/** 032 C6: a dodge lands (and waits for the strike frame) exactly where a hit would. */
type ImpactEvent = HitEvent | Extract<BattleEvent, { kind: "dodge" }>;

export interface CombatOverlayData {
  floorNumber: number;
  /** 019 FR-003: the monster's display name, never `enemy.id`. */
  enemyName: string;
  player: CombatantStats;
  monster: CombatantStats;
  playerMaxHp: number;
  potionCount: number;
  /** Texture keys already ensured by the caller (textures are game-wide). */
  playerTextureKey: string;
  monsterTextureKey: string;
  /** 030: the species' sprite key, from which the side-profile attack frames are derived. */
  monsterSpeciesKey: string;
  /** 031 (contract C5): the Prince's raw look, so the duel can bake his attack frames too —
   * `playerTextureKey` alone only covers idle. */
  playerTier: ArmourTierId;
  playerWeapon: WeaponId | null;
  /** Readable drop phrases for the victory panel (`describeDrops`). */
  dropPhrases: string[];
  /** Fires exactly once, the instant the battle ends — before any outcome panel — so the
   * result is saved even if the game closes while the panel is up (research R13, C14). */
  onBattleEnd: (result: BattleEndResult) => void;
  /** Fires when the player leaves the modal (Continue, or immediately after fleeing). */
  onContinue: (outcome: BattleEndOutcome) => void;
}

/**
 * 027 combat modal layout, in DESIGN units (research R10): a 600×375 (16:10) frame centred in
 * the 640×640 play area. Mockup 1c measurements are scaled by 600/848.
 */
const FRAME = { w: 600, h: 375 };
const FRAME_X = DESIGN_PLAY_AREA.x + (DESIGN_PLAY_AREA.width - FRAME.w) / 2;
const FRAME_Y = DESIGN_PLAY_AREA.y + (DESIGN_PLAY_AREA.height - FRAME.h) / 2;
/** 256 canvas px = 8× the 32×32 sprite grids, so every sprite pixel stays a whole block. */
const SPRITE = 256 / RENDER_SCALE;
/** 030: wide enough that the monster's strike (12 sprite px of reach) stops short of "VS". */
const CENTRE_COLUMN = 200;
const BAR = { w: 113, h: 6 };
const BOTTOM_MARGIN = 21;
const BAR_GAP = 7;
const BUTTON_GAP = 30;

const SIDE_COLUMN = (FRAME.w - CENTRE_COLUMN) / 2;
// 030: Potion/Flee sit at the bottom of the centre column and the fighters stand above them, so
// no attack frame (32 rows tall, like idle) can ever reach down over the buttons.
const FLEE_Y = FRAME_Y + FRAME.h - BOTTOM_MARGIN - 12;
const POTION_Y = FLEE_Y - BUTTON_GAP;
const SPRITE_CENTRE_Y = POTION_Y - 24 - SPRITE / 2;
const BAR_TOP = SPRITE_CENTRE_Y + SPRITE / 2 + BAR_GAP;
const SPRITE_CENTRE_X: Record<Side, number> = {
  player: FRAME_X + SIDE_COLUMN - SPRITE / 2,
  monster: FRAME_X + SIDE_COLUMN + CENTRE_COLUMN + SPRITE / 2,
};
const CENTRE_X = FRAME_X + FRAME.w / 2;

const GOLD = "#d9aa3b";
const HIT_FLASH_MS = 140;

const toCanvas = (designUnits: number) => designUnits * RENDER_SCALE;

/** Injected once: the floating damage/heal number rises and fades (research R11). */
const POP_STYLE_ID = "combat-pop-style";
function ensurePopStyle(): void {
  if (document.getElementById(POP_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = POP_STYLE_ID;
  style.textContent = `
    @keyframes combat-pop {
      0% { transform: translateY(6px) scale(0.6); opacity: 0; }
      15% { transform: translateY(0) scale(1.15); opacity: 1; }
      30% { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-32px) scale(1); opacity: 0; }
    }`;
  document.head.appendChild(style);
}

function div(styles: Partial<CSSStyleDeclaration>, testId?: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "absolute";
  Object.assign(el.style, styles);
  if (testId) el.dataset.testid = testId;
  return el;
}

interface SideView {
  sprite: Phaser.GameObjects.Image;
  hpNumber: HTMLElement;
  hpFill: HTMLDivElement;
  barFill: HTMLDivElement;
}

/**
 * 027 (contracts C9–C15): the live combat modal, design 1c "Framed duel". Renders whatever the
 * pure battle reducer (`domain/combat/battle.ts`) reports and owns no combat rules. Keeps the
 * `CombatOverlay` scene key so the side panel's pause-button guard and the e2e helpers keep
 * working unchanged (research R9).
 *
 * Pointer-only by design (C12, FR-044, CLAUDE.md): this scene registers no keyboard input at
 * all. The old "any key reveals/closes" handler and the text combat log are gone (FR-043/FR-052).
 */
export class CombatOverlay extends Phaser.Scene {
  private data_!: CombatOverlayData;
  private state_!: BattleState;
  private ended_ = false;
  private views_!: Record<Side, SideView>;
  private nodes_: HTMLElement[] = [];
  /** Buttons that must be disabled the instant the battle ends (C14). */
  private actionButtons_: HTMLButtonElement[] = [];
  private outcomeLayer_?: Phaser.GameObjects.Rectangle;
  private potionButton_!: HTMLButtonElement;
  /** 030 (data-model.md §3): whether this monster has side-profile attack art (FR-009). */
  private animates_ = false;
  /** ms into the monster's attack animation, on the focus-gated battle clock; null = not attacking. */
  private attackElapsedMs_: number | null = null;
  /** The monster's hit, held back until its strike frame (FR-005). */
  private pendingImpact_: ImpactEvent | null = null;
  private attackFrame_: MonsterCombatFrame = "idle";
  /** 031: ms into the Prince's swing on the same gated clock; null = not swinging. */
  private playerAttackElapsedMs_: number | null = null;
  private playerAttackFrame_: "idle" | PlayerAttackFrame = "idle";

  constructor() {
    super("CombatOverlay");
  }

  init(data: CombatOverlayData): void {
    this.data_ = data;
    this.state_ = startBattle(data.player, data.monster, data.playerMaxHp, data.potionCount);
    this.ended_ = false;
    this.nodes_ = [];
    this.actionButtons_ = [];
    this.outcomeLayer_ = undefined;
    this.animates_ = hasMonsterCombatFrames(data.monsterSpeciesKey);
    this.attackElapsedMs_ = null;
    this.pendingImpact_ = null;
    this.attackFrame_ = "idle";
    this.playerAttackElapsedMs_ = null;
    this.playerAttackFrame_ = "idle";
  }

  create(): void {
    ensurePopStyle();
    const root = getUiRoot();
    const add = <T extends HTMLElement>(el: T): T => {
      root.appendChild(el);
      this.nodes_.push(el);
      return el;
    };
    this.events.once("shutdown", () => this.nodes_.forEach((el) => el.remove()));

    // Canvas: the dimmed floor behind the modal, the frame's interior, and the sprites.
    this.add
      .rectangle(PLAY_AREA.x + PLAY_AREA.width / 2, PLAY_AREA.y + PLAY_AREA.height / 2, PLAY_AREA.width, PLAY_AREA.height, 0x040509, 0.74)
      .setDepth(0);
    this.add
      .rectangle(toCanvas(FRAME_X + FRAME.w / 2), toCanvas(FRAME_Y + FRAME.h / 2), toCanvas(FRAME.w), toCanvas(FRAME.h), 0x0b0d14, 1)
      .setDepth(1);

    // DOM: the gold frame border (transparent inside, so the canvas sprites show through).
    add(
      div(
        {
          left: px(FRAME_X),
          top: px(FRAME_Y),
          width: px(FRAME.w),
          height: px(FRAME.h),
          border: `2px solid ${GOLD}`,
          boxShadow: "0 0 0 3px #0b0d14, 0 0 0 4px #6a4418",
        },
        "combat-modal",
      ),
    );

    const title = add(
      createUiText(`Floor ${this.data_.floorNumber} · ${this.data_.enemyName}`, {
        x: CENTRE_X,
        y: FRAME_Y,
        fontSize: 14,
        color: GOLD,
      }),
    );
    Object.assign(title.style, {
      background: "#0b0d14",
      border: `2px solid ${GOLD}`,
      padding: `${px(3)} ${px(12)}`,
      letterSpacing: "0.15em",
      whiteSpace: "nowrap",
    });

    add(createUiText("VS", { x: CENTRE_X, y: SPRITE_CENTRE_Y - 34, fontSize: 28, color: "#6a4418" }));

    this.views_ = {
      player: this.buildSide("player", add),
      monster: this.buildSide("monster", add),
    };

    // C17: drinks one carried potion at once; disabled with none left, at full HP, or once ended.
    this.potionButton_ = this.addActionButton("", POTION_Y, "combat-potion", () => {
      const step = drinkPotion(this.state_);
      if (step.events.length === 0) return;
      this.state_ = step.state;
      step.events.forEach((event) => this.showEvent(event));
      playSfx(this.sound, sfxPotion);
      this.refresh();
    });
    Object.assign(this.potionButton_.style, { background: GOLD, color: "#1a1206", borderColor: GOLD });

    // C13: Flee works at any moment until an outcome appears, and closes the modal at once.
    this.addActionButton("Flee", FLEE_Y, "combat-flee", () => {
      if (this.ended_) return;
      this.state_ = flee(this.state_);
      this.endBattle("fled");
    });

    this.refresh();
  }

  /** Centre-column action button below the fighters (Potion, Flee); disabled the instant the battle ends. */
  private addActionButton(label: string, y: number, testId: string, onActivate: () => void): HTMLButtonElement {
    const button = createMenuOption(this, { x: CENTRE_X, y, label, fontSize: 13, color: "#e6e9f2", onActivate });
    button.dataset.testid = testId;
    Object.assign(button.style, { border: "2px solid #6a4418", padding: `${px(3)} ${px(10)}`, minWidth: px(85) });
    this.actionButtons_.push(button);
    return button;
  }

  private buildSide(side: Side, add: <T extends HTMLElement>(el: T) => T): SideView {
    const isPlayer = side === "player";
    const name = isPlayer ? "Prince" : this.data_.enemyName;
    const maxHp = isPlayer ? this.data_.playerMaxHp : this.data_.monster.hp;

    const key = isPlayer ? this.data_.playerTextureKey : this.data_.monsterTextureKey;
    const sprite = this.add.image(toCanvas(SPRITE_CENTRE_X[side]), toCanvas(SPRITE_CENTRE_Y), key).setDepth(2);
    if (isPlayer) {
      // 031 (contract C5): the mirror of the monster below — scaled so a 44-wide swing keeps the
      // pixel size, anchored on the LEFT edge where every frame's body lines up (no dx), so only
      // the blade reaches out, rightward at the monster.
      sprite
        .setScale(toCanvas(SPRITE) / 32)
        .setOrigin(0, 0.5)
        .setX(toCanvas(SPRITE_CENTRE_X.player - SPRITE / 2));
    } else {
      // 030 (contract C4): scaled, not sized, so a 44-wide attack frame keeps the same pixel size
      // (FR-006a); and anchored on the right edge of the usual box, where every frame's body
      // lines up (the sheet's dx = 32 - w), so only the reach moves — leftward, at the Prince.
      sprite
        .setScale(toCanvas(SPRITE) / 32)
        .setOrigin(1, 0.5)
        .setX(toCanvas(SPRITE_CENTRE_X.monster + SPRITE / 2));
    }

    // Health readout in this side's top corner (C10, FR-039).
    const blockW = 184;
    const blockX = isPlayer ? FRAME_X + 20 : FRAME_X + FRAME.w - 20 - blockW;
    const block = add(
      div({ left: px(blockX), top: px(FRAME_Y + 20), width: px(blockW), color: "#e6e9f2" }, `combat-${side}-hp`),
    );
    const heading = document.createElement("div");
    Object.assign(heading.style, {
      display: "flex",
      alignItems: "baseline",
      gap: px(6),
      justifyContent: isPlayer ? "flex-start" : "flex-end",
    });
    const hpNumber = document.createElement("span");
    hpNumber.style.fontSize = px(31);
    hpNumber.dataset.testid = `combat-${side}-hp-value`;
    const label = document.createElement("span");
    Object.assign(label.style, { fontSize: px(11), color: "#8a94ab", letterSpacing: "0.08em" });
    label.textContent = isPlayer ? `/ ${maxHp} · ${name}` : `${name} · ${maxHp} /`;
    if (isPlayer) heading.append(hpNumber, label);
    else heading.append(label, hpNumber);

    const hpTrack = document.createElement("div");
    Object.assign(hpTrack.style, {
      height: px(7),
      marginTop: px(4),
      background: "#1a1f2d",
      border: "2px solid #07080c",
      display: "flex",
      justifyContent: isPlayer ? "flex-start" : "flex-end",
    });
    const hpFill = document.createElement("div");
    Object.assign(hpFill.style, { height: "100%", background: "#c8443a" });
    hpTrack.appendChild(hpFill);
    block.append(heading, hpTrack);

    // Attack bar directly under the sprite: gold for the player, orange for the monster (FR-040).
    const barTrack = add(
      div(
        {
          left: px(SPRITE_CENTRE_X[side] - BAR.w / 2),
          top: px(BAR_TOP),
          width: px(BAR.w),
          height: px(BAR.h),
          background: "#1a1f2d",
          border: "2px solid #07080c",
        },
        `combat-${side}-bar`,
      ),
    );
    const barFill = div({ left: "0", top: "0", height: "100%", background: isPlayer ? GOLD : "#ff7a3a" });
    barTrack.appendChild(barFill);

    return { sprite, hpNumber, hpFill, barFill };
  }

  override update(_time: number, delta: number): void {
    if (this.ended_) return;
    // FR-010 (research R3): the battle clock only runs while the game has focus, and a long
    // stall can't land a burst of hits on return.
    const elapsedSec = document.hasFocus() ? Math.min(delta, 100) / 1000 : 0;
    // 030 (C8): the attack animation runs on the same gated clock, so it freezes with the battle.
    this.advanceMonsterAttack(elapsedSec * 1000);
    this.advancePlayerAttack(elapsedSec * 1000);
    const step = advanceBattle(this.state_, elapsedSec, Math.random);
    this.state_ = step.state;
    step.events.forEach((event) => this.showEvent(event));
    this.refresh();
    if (this.state_.outcome !== "ongoing") this.endBattle(this.state_.outcome);
  }

  /** Re-renders both health readouts and attack bars from the current battle state. */
  private refresh(): void {
    for (const side of ["player", "monster"] as const) {
      const c = this.state_[side];
      const maxHp = side === "player" ? this.state_.playerMaxHp : this.data_.monster.hp;
      const view = this.views_[side];
      view.hpNumber.textContent = String(c.hp);
      view.hpFill.style.width = `${Math.round((c.hp / Math.max(1, maxHp)) * 100)}%`;
      const charge = this.ended_ ? 0 : Math.min(1, c.charge / c.attackIntervalSec);
      view.barFill.style.width = `${Math.round(charge * 100)}%`;
    }
    const { potionCount, player, playerMaxHp } = this.state_;
    this.potionButton_.textContent = `Potion ×${potionCount}`;
    this.potionButton_.disabled = this.ended_ || potionCount <= 0 || player.hp >= playerMaxHp;
    this.potionButton_.style.opacity = this.potionButton_.disabled ? "0.4" : "1";
  }

  private showEvent(event: BattleEvent): void {
    if (event.kind === "hit" || event.kind === "dodge") {
      // 030 (C6/C7): the monster's attacks wait for its strike frame; the Prince's land at once (FR-008).
      // `target` is the defender for hits and dodges alike, so a player target means a monster swing.
      if (event.target === "player" && this.animates_) this.startMonsterAttack(event);
      else this.applyHitFeedback(event);
      // 031 (C5): the Prince swings alongside his (still immediate) feedback.
      if (event.target === "monster") this.startPlayerAttack();
      return;
    }
    const sfxKey = battleEventToSfxKey(event); // 028 C5–C8
    if (sfxKey) playSfx(this.sound, sfxKey);
    this.floatNumber("player", `+${event.amount}`, { fontSize: 34, color: "#7fd18a" });
  }

  /** C11: hits flash the target white and float their damage up over it. */
  private applyHitFeedback(event: ImpactEvent): void {
    if (event.kind === "dodge") {
      this.floatNumber(event.target, "Dodge", { fontSize: 30, color: "#9ec9ff" });
      return;
    }
    const sfxKey = battleEventToSfxKey(event); // 028 C5–C8
    if (sfxKey) playSfx(this.sound, sfxKey);
    const sprite = this.views_[event.target].sprite;
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(HIT_FLASH_MS, () => sprite.clearTint());
    this.floatNumber(event.target, String(event.damage), this.popStyle(event));
  }

  /** 030 (C6): (re)starts the attack from its wind-up. A hit still waiting on an earlier strike
   * lands first, so a fast attacker never drops one (US3 AC1). */
  private startMonsterAttack(event: ImpactEvent): void {
    this.flushImpact();
    this.pendingImpact_ = event;
    this.attackElapsedMs_ = 0;
    this.advanceMonsterAttack(0);
  }

  private advanceMonsterAttack(deltaMs: number): void {
    if (this.attackElapsedMs_ === null) return;
    this.attackElapsedMs_ += deltaMs;
    if (this.attackElapsedMs_ >= MONSTER_ATTACK_IMPACT_MS) this.flushImpact(); // C7
    const frame = computeMonsterAttackFrame(this.attackElapsedMs_);
    if (frame === null) this.attackElapsedMs_ = null;
    this.setMonsterFrame(frame ?? "idle");
  }

  private flushImpact(): void {
    if (!this.pendingImpact_) return;
    const event = this.pendingImpact_;
    this.pendingImpact_ = null;
    this.applyHitFeedback(event);
  }

  private setMonsterFrame(frame: MonsterCombatFrame): void {
    if (frame === this.attackFrame_) return;
    this.attackFrame_ = frame;
    this.views_.monster.sprite.setTexture(ensureMonsterCombatTexture(this, this.data_.monsterSpeciesKey, frame));
  }

  /** 031 (C5): (re)starts the Prince's swing from attackA, so a fast attacker never drops one. */
  private startPlayerAttack(): void {
    this.playerAttackElapsedMs_ = 0;
    this.advancePlayerAttack(0);
  }

  private advancePlayerAttack(deltaMs: number): void {
    if (this.playerAttackElapsedMs_ === null) return;
    this.playerAttackElapsedMs_ += deltaMs;
    const frame = computePlayerAttackFrame(this.playerAttackElapsedMs_);
    if (frame === null) this.playerAttackElapsedMs_ = null;
    this.setPlayerFrame(frame ?? "idle");
  }

  private setPlayerFrame(frame: "idle" | PlayerAttackFrame): void {
    if (frame === this.playerAttackFrame_) return;
    this.playerAttackFrame_ = frame;
    const { playerTier, playerWeapon } = this.data_;
    this.views_.player.sprite.setTexture(ensurePlayerTexture(this, playerTier, playerWeapon, "right", frame));
  }

  /** C11/FR-018: a critical strike's number is larger and red, unmistakable from a normal hit. */
  private popStyle(event: Extract<BattleEvent, { kind: "hit" }>): { fontSize: number; color: string; crit?: true } {
    if (event.isCrit) return { fontSize: 50, color: "#ff3b3b", crit: true };
    return { fontSize: 34, color: event.target === "player" ? "#ff8a7a" : "#ffffff" };
  }

  private floatNumber(side: Side, text: string, style: { fontSize: number; color: string; crit?: true }): void {
    const anchor = div(
      {
        left: px(SPRITE_CENTRE_X[side] + (Math.random() - 0.5) * 40),
        top: px(SPRITE_CENTRE_Y - SPRITE / 2 + 10),
        transform: "translateX(-50%)",
        pointerEvents: "none",
      },
      "combat-pop",
    );
    const label = document.createElement("div");
    label.textContent = text;
    Object.assign(label.style, {
      fontSize: px(style.fontSize),
      lineHeight: "1",
      color: style.color,
      fontWeight: "bold",
      textShadow: "0 2px 0 #07080c, 2px 0 0 #07080c, -2px 0 0 #07080c, 0 -2px 0 #07080c",
      animation: "combat-pop 1s ease-out forwards",
    });
    if (style.crit) anchor.dataset.crit = "true";
    anchor.appendChild(label);
    anchor.addEventListener("animationend", () => anchor.remove());
    getUiRoot().appendChild(anchor);
    this.nodes_.push(anchor);
  }

  /** The battle has ended: save first (onBattleEnd), then show what happened (C14). */
  private endBattle(outcome: BattleEndOutcome): void {
    if (this.ended_) return;
    this.ended_ = true;
    // 030 (C9): any hit still waiting on its strike lands now, before the outcome. A killing blow
    // freezes the monster mid-strike; otherwise it settles back to its side profile (US3 AC2–AC4).
    // update() stops once ended_ is set, so nothing advances the animation after this.
    if (this.attackElapsedMs_ !== null) {
      this.flushImpact();
      this.attackElapsedMs_ = null;
      this.setMonsterFrame(outcome === "defeat" ? "attackB" : "idle");
    }
    // 031 (C5, FR-010): unlike the monster, the Prince always settles — he is the sprite dimmed on
    // defeat, where a frozen lunge would read as a rendering bug.
    if (this.playerAttackElapsedMs_ !== null) {
      this.playerAttackElapsedMs_ = null;
      this.setPlayerFrame("idle");
    }
    const sfxKey = battleOutcomeToSfxKey(outcome); // 028 C2–C4: once per battle, silent on flee
    if (sfxKey) playSfx(this.sound, sfxKey);
    this.actionButtons_.forEach((button) => {
      button.disabled = true;
      button.style.opacity = "0.4"; // inline colours override the stylesheet's :disabled grey
    });
    this.refresh();
    this.data_.onBattleEnd({
      outcome,
      playerHp: this.state_.player.hp,
      potionCount: this.state_.potionCount,
    });

    const loser = outcome === "victory" ? "monster" : outcome === "defeat" ? "player" : undefined;
    if (loser) this.views_[loser].sprite.setAlpha(0.3);

    if (outcome === "fled") {
      this.data_.onContinue(outcome);
      return;
    }
    this.showOutcomePanel(outcome);
  }

  private showOutcomePanel(outcome: "victory" | "defeat"): void {
    this.outcomeLayer_ = this.add
      .rectangle(toCanvas(FRAME_X + FRAME.w / 2), toCanvas(FRAME_Y + FRAME.h / 2), toCanvas(FRAME.w), toCanvas(FRAME.h), 0x07080c, 0.82)
      .setDepth(3);

    const won = outcome === "victory";
    const panel = div(
      {
        left: px(CENTRE_X),
        top: px(FRAME_Y + FRAME.h / 2),
        transform: "translate(-50%, -50%)",
        minWidth: px(212),
        padding: `${px(18)} ${px(26)}`,
        background: "#0d1018",
        border: `2px solid ${won ? GOLD : "#2a3350"}`,
        textAlign: "center",
        color: "#e6e9f2",
      },
      "combat-outcome",
    );
    const heading = document.createElement("div");
    heading.textContent = won ? "Victory" : "The prince falls";
    Object.assign(heading.style, { fontSize: px(32), color: won ? GOLD : "#c8443a", letterSpacing: "0.06em" });
    const detail = document.createElement("div");
    detail.textContent = won ? `The ${this.data_.enemyName} falls.` : `Slain by ${this.data_.enemyName}.`;
    Object.assign(detail.style, { fontSize: px(10), color: "#8a94ab", marginTop: px(6) });
    panel.append(heading, detail);
    if (won && this.data_.dropPhrases.length > 0) {
      const drops = document.createElement("div");
      drops.textContent = this.data_.dropPhrases.join(" · ");
      Object.assign(drops.style, { fontSize: px(13), marginTop: px(10) });
      panel.appendChild(drops);
    }

    // Continue lives inside the panel; click only, no key (C12, FR-052).
    const cont = document.createElement("button");
    cont.className = "ui-menu-option";
    cont.textContent = "Continue";
    cont.dataset.testid = "combat-continue";
    Object.assign(cont.style, {
      position: "relative",
      display: "inline-block",
      marginTop: px(14),
      padding: `${px(5)} ${px(18)}`,
      fontSize: px(14),
      color: "#1a1206",
      background: GOLD,
    });
    cont.addEventListener("click", () => this.data_.onContinue(outcome));
    attachMenuSounds(this, cont);
    panel.appendChild(cont);

    getUiRoot().appendChild(panel);
    this.nodes_.push(panel);
  }
}
