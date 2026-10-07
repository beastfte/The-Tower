import Phaser from "phaser";
import type { Side } from "../../domain/combat/battle";
import { DESIGN_PLAY_AREA } from "../gameConfig";
import { RENDER_SCALE } from "../scaleConfig";
import { createUiText, getUiRoot, px } from "../ui/domOverlay";
import { playSfx, sfxEncounter } from "../sfx";

export interface CombatIntroData {
  floorNumber: number;
  enemyName: string;
  /** Texture keys already ensured by the caller, the same two CombatOverlay is handed. */
  playerTextureKey: string;
  monsterTextureKey: string;
  /** Fires once, INTRO_MS after the intro starts; FloorScene stops this scene and opens the duel. */
  onComplete: () => void;
}

/** 029 (contract C3): the one value the whole sequence is timed from — provisional, per the spec. */
export const INTRO_MS = 1000;
/** Mockup keyframe percentage → ms (research R5). */
const at = (fraction: number) => fraction * INTRO_MS;

/**
 * Layout in DESIGN units: the "2b — Letterbox VS" mockup's 960×600 stage scaled by 640/960 and
 * anchored on the play area's vertical centre (research R4, data-model.md §3).
 */
const CX = DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2;
const CY = DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height / 2;
const W = DESIGN_PLAY_AREA.width;
const BAR_H = 73;
const BAND_H = 85;
const BAND_RULE = 2;
/** 224 canvas px = 7× the 32×32 sprite grids, so every sprite pixel stays a whole block. */
const SPRITE = 224 / RENDER_SCALE;
const SPRITE_X: Record<Side, number> = { player: CX - 172, monster: CX + 172 };
const SPRITE_Y = CY - 32 / 3;
const NAME_TOP = SPRITE_Y + SPRITE / 2 + 4;
const NAME_SIZE = 20;
const VS_TOP = CY - 36;
const VS_SIZE = 79;
const FLOOR_SIZE = 12;
const SLIDE_IN = W / 3;
const SLIDE_OUT = 40;

const GOLD = "#d9aa3b";
const STROKE = "0 2px 0 #07080c, 2px 0 0 #07080c, -2px 0 0 #07080c, 0 -2px 0 #07080c";
const EASE = "Cubic.easeOut"; // nearest named curve to the mockup's cubic-bezier(.2,.7,.2,1) (research R6)

const toCanvas = (designUnits: number) => designUnits * RENDER_SCALE;

/** Injected once: the mockup's `bn-word` keyframes, verbatim (research R5). */
const STYLE_ID = "combat-intro-style";
function ensureIntroStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes combat-intro-vs {
      0%, 16% { opacity: 0; transform: scale(2.4); }
      24% { opacity: 1; transform: scale(0.94); }
      29% { transform: scale(1); }
      82% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.12); }
    }`;
  document.head.appendChild(style);
}

/**
 * A flat-colour copy of `key` (every opaque pixel painted `color`), cached per colour. Tint is
 * WebGL-only in Phaser and this game renders with Phaser.CANVAS, so the silhouette flash is done
 * the way the mockup does it: `source-atop` fill over the sprite (research R7).
 */
function ensureSilhouette(scene: Phaser.Scene, key: string, color: string): string {
  const silhouetteKey = `${key}-silhouette-${color}`;
  if (scene.textures.exists(silhouetteKey)) return silhouetteKey;
  const { width, height } = scene.textures.getFrame(key);
  const texture = scene.textures.createCanvas(silhouetteKey, width, height)!;
  texture.drawFrame(key, undefined, 0, 0, false);
  const ctx = texture.getContext();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return silhouetteKey;
}

/**
 * 029: the one-second letterbox "VS" intro that plays before the duel screen (CombatOverlay).
 * Bars, band and fighters are canvas — `#ui-root` sits above the canvas, so a DOM band would hide
 * the fighters painted over it (research R3); names and "VS" are DOM text like every other label.
 *
 * Pointer-only and unskippable by construction (C4): this scene binds no input and adds nothing
 * clickable, and FloorScene is paused underneath it.
 */
export class CombatIntroScene extends Phaser.Scene {
  private data_!: CombatIntroData;
  private nodes_: HTMLElement[] = [];
  private fighters_!: Record<Side, Phaser.GameObjects.Container>;
  private names_!: Record<Side, HTMLElement>;

  constructor() {
    super("CombatIntroScene");
  }

  init(data: CombatIntroData): void {
    this.data_ = data;
    this.nodes_ = [];
  }

  create(): void {
    playSfx(this.sound, sfxEncounter); // 029 C9 (amends 028 C1): the cue opens the intro
    ensureIntroStyle();
    const root = getUiRoot();
    const add = <T extends HTMLElement>(el: T): T => {
      root.appendChild(el);
      this.nodes_.push(el);
      return el;
    };
    this.events.once("shutdown", () => this.nodes_.forEach((el) => el.remove()));

    // The dimmed floor — identical to CombatOverlay's, so the hand-over doesn't flicker (C5).
    this.add.rectangle(toCanvas(CX), toCanvas(CY), toCanvas(W), toCanvas(DESIGN_PLAY_AREA.height), 0x040509, 0.74);

    // Letterbox bars: slide in over 0–14%, hold, withdraw over 84–100%.
    const bottom = DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height;
    for (const [from, to] of [
      [DESIGN_PLAY_AREA.y - BAR_H / 2, DESIGN_PLAY_AREA.y + BAR_H / 2],
      [bottom + BAR_H / 2, bottom - BAR_H / 2],
    ] as const) {
      const bar = this.add.rectangle(toCanvas(CX), toCanvas(from), toCanvas(W), toCanvas(BAR_H), 0x000000);
      this.tweens.add({ targets: bar, y: toCanvas(to), duration: at(0.14), hold: at(0.7), yoyo: true, ease: EASE });
    }

    // Gold-ruled band: widens from its centre over 12–26%, fades over 82–100%.
    const band = this.add
      .container(toCanvas(CX), toCanvas(CY), [
        this.add.rectangle(0, 0, toCanvas(W), toCanvas(BAND_H), 0x0b0d14),
        this.add.rectangle(0, -toCanvas(BAND_H / 2), toCanvas(W), toCanvas(BAND_RULE), 0xd9aa3b),
        this.add.rectangle(0, toCanvas(BAND_H / 2), toCanvas(W), toCanvas(BAND_RULE), 0xd9aa3b),
      ])
      .setScale(0, 1);
    this.tweens.chain({
      targets: band,
      tweens: [
        { scaleX: 1, delay: at(0.12), duration: at(0.14), ease: EASE },
        { alpha: 0, delay: at(0.56), duration: at(0.18), ease: EASE },
      ],
    });

    this.fighters_ = { player: this.buildFighter("player"), monster: this.buildFighter("monster") };
    this.names_ = {
      player: add(this.nameLabel("Prince")),
      monster: add(this.nameLabel(this.data_.enemyName)),
    };

    // "VS" and the floor number: an outer box for position, an inner one for the zoom (C2).
    const vs = add(document.createElement("div"));
    vs.dataset.testid = "combat-intro";
    Object.assign(vs.style, { position: "absolute", left: px(CX), top: px(VS_TOP), transform: "translateX(-50%)" });
    const zoom = document.createElement("div");
    Object.assign(zoom.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: px(0),
      animation: `combat-intro-vs ${INTRO_MS}ms cubic-bezier(.2, .7, .2, 1) both`,
    });
    const word = document.createElement("span");
    word.textContent = "VS";
    Object.assign(word.style, { fontSize: px(VS_SIZE), lineHeight: "0.75", color: GOLD, textShadow: STROKE, fontWeight: "bold" });
    const floor = document.createElement("span");
    floor.textContent = `Floor ${this.data_.floorNumber}`;
    Object.assign(floor.style, { fontSize: px(FLOOR_SIZE), letterSpacing: "0.3em", color: "#8a94ab", whiteSpace: "nowrap" });
    zoom.append(word, floor);
    vs.appendChild(zoom);

    this.time.delayedCall(INTRO_MS, () => this.data_.onComplete());
  }

  /** One fighter: colour sprite under a white and a black silhouette. Fading the black one out
   * (30–42%) then the white one (42–55%) is the mockup's brightness 0 → 2.4 → 1 flash. */
  private buildFighter(side: Side): Phaser.GameObjects.Container {
    const key = side === "player" ? this.data_.playerTextureKey : this.data_.monsterTextureKey;
    const layer = (textureKey: string) =>
      this.add.image(0, 0, textureKey).setDisplaySize(toCanvas(SPRITE), toCanvas(SPRITE));
    const white = layer(ensureSilhouette(this, key, "#ffffff"));
    const black = layer(ensureSilhouette(this, key, "#000000"));
    const outward = side === "player" ? -1 : 1;
    const x = toCanvas(SPRITE_X[side]);
    const fighter = this.add.container(x + outward * toCanvas(SLIDE_IN), toCanvas(SPRITE_Y), [layer(key), white, black]);
    fighter.setAlpha(0);

    // Slide in + fade in over 8–26%, hold, drift back out + fade over 82–100%.
    this.tweens.chain({
      targets: fighter,
      tweens: [
        { x, alpha: 1, delay: at(0.08), duration: at(0.18), ease: EASE },
        { x: x + outward * toCanvas(SLIDE_OUT), alpha: 0, delay: at(0.56), duration: at(0.18), ease: EASE },
      ],
    });
    this.tweens.add({ targets: black, alpha: 0, delay: at(0.3), duration: at(0.12) });
    this.tweens.add({ targets: white, alpha: 0, delay: at(0.42), duration: at(0.13) });
    return fighter;
  }

  private nameLabel(text: string): HTMLElement {
    const label = createUiText(text, { x: CX, y: NAME_TOP, originY: 0, fontSize: NAME_SIZE, color: "#e6e9f2" });
    Object.assign(label.style, { letterSpacing: "0.12em", textShadow: STROKE, whiteSpace: "nowrap", opacity: "0" });
    return label;
  }

  /** Names ride their fighters: read off the sprite each frame so they can't drift (research R8). */
  override update(): void {
    for (const side of ["player", "monster"] as const) {
      const fighter = this.fighters_[side];
      this.names_[side].style.left = px(fighter.x / RENDER_SCALE);
      this.names_[side].style.opacity = String(fighter.alpha);
    }
  }
}
