import type { MonsterSpeciesId } from "../domain/floor/types";
import { PLAYER_IDLE_FRAME_MS } from "./playerAnimation";

/** 030: the sheet's own frame names for `MONSTER_SPRITES[name].left` — sprite vocabulary, like
 * `PlayerFrame`; the combat rules in `domain/combat` never see it. */
export type MonsterCombatFrame = "idle" | "breath" | "attackA" | "attackB";

/** 030 research R4: the sheet's preview steps its attack sequence (`atkSeq`) every 9 animation
 * frames (~60fps), i.e. ~150 ms — the same cadence and conversion as `PLAYER_WALK_FRAME_MS`. The
 * preview holds some frames for 2-3 steps (~1050 ms in all), which would outlast the Bat's 0.6s
 * attack interval, so each frame gets exactly one beat here. */
export const MONSTER_ATTACK_FRAME_MS = 150;

/** Wind-up (the breath pose, as the sheet's own `atkSeq` uses it), swing, then the held strike. */
const ATTACK_SEQUENCE: readonly Exclude<MonsterCombatFrame, "idle">[] = ["breath", "attackA", "attackB"];

/** The instant the held strike first shows — where the Prince's hit feedback lands (FR-005). */
export const MONSTER_ATTACK_IMPACT_MS = MONSTER_ATTACK_FRAME_MS * ATTACK_SEQUENCE.indexOf("attackB");
export const MONSTER_ATTACK_MS = MONSTER_ATTACK_FRAME_MS * ATTACK_SEQUENCE.length;

/** One play-through of the attack, a pure function of elapsed time (the shape of
 * `computePlayerWalkFrame`), or `null` once it is over and the monster should be back at idle. */
export function computeMonsterAttackFrame(elapsedMs: number): Exclude<MonsterCombatFrame, "idle"> | null {
  return ATTACK_SEQUENCE[Math.floor(elapsedMs / MONSTER_ATTACK_FRAME_MS)] ?? null;
}

/** 039: how a monster idles — floor motion style, and the combat pose applied on top of the
 * idle/breath frame swap. Presentation-only (research R2), so not a `MonsterSpecies` field. */
export type MonsterIdleStyle = "breathe" | "squash" | "hover";

/** Multipliers on a marker's resting scale, plus a vertical offset as a fraction of its box height. */
export interface MonsterIdlePose {
  readonly sx: number;
  readonly sy: number;
  readonly dy: number;
}

export const IDLE_POSE_IDENTITY: MonsterIdlePose = { sx: 1, sy: 1, dy: 0 };

const IDLE_STYLE: Partial<Record<MonsterSpeciesId, MonsterIdleStyle>> = { slime: "squash", bat: "hover" };

export function monsterIdleStyle(id: MonsterSpeciesId): MonsterIdleStyle {
  return IDLE_STYLE[id] ?? "breathe";
}

const BREATHE_PERIOD_MS = 1600;
const SQUASH_PERIOD_MS = 900;
const HOVER_PERIOD_MS = 1200;
const FLUTTER_PERIOD_MS = 180;
const BREATHE_STRETCH = 0.04;
const BREATHE_NARROW = 0.02;
const SQUASH_AMOUNT = 0.08;
const HOVER_RISE = 0.08;
const FLUTTER_DEPTH = 0.08;

/** 039 research R4: `computePositionPhase` is 7x+13y, tiny as milliseconds against a ~1s period, so
 * neighbours would move in lockstep. Spread it; 580 was searched so orthogonal neighbours land
 * >= 28% of a cycle apart for all three periods. */
export const PHASE_SPREAD_MS = 580;

const IDLE_PERIOD_MS: Record<MonsterIdleStyle, number> = {
  breathe: BREATHE_PERIOD_MS,
  squash: SQUASH_PERIOD_MS,
  hover: HOVER_PERIOD_MS,
};

/** Offset (ms) into the style's cycle for a tile's `computePositionPhase`. */
export function idlePhaseOffsetMs(style: MonsterIdleStyle, phase: number): number {
  return (phase * PHASE_SPREAD_MS) % IDLE_PERIOD_MS[style];
}

/** Bounded periodic pose for a time (ms) and per-tile phase — a pure function of time, so it survives
 * `FloorScene.redraw()` rebuilding every marker on each move. */
export function computeMonsterIdlePose(style: MonsterIdleStyle, timeMs: number, phase: number): MonsterIdlePose {
  const t = timeMs + idlePhaseOffsetMs(style, phase);
  const s = Math.sin((t / IDLE_PERIOD_MS[style]) * Math.PI * 2);
  switch (style) {
    case "breathe":
      return { sx: 1 - BREATHE_NARROW * s, sy: 1 + BREATHE_STRETCH * s, dy: 0 };
    case "squash":
      return { sx: 1 - SQUASH_AMOUNT * s, sy: 1 + SQUASH_AMOUNT * s, dy: 0 };
    case "hover":
      return {
        sx: 1,
        sy: 1 - FLUTTER_DEPTH * Math.abs(Math.sin((t / FLUTTER_PERIOD_MS) * Math.PI * 2)),
        dy: HOVER_RISE * s,
      };
  }
}

/** Combat idle: the sheet's 2-frame breathing pair at the player/merchant cadence. */
export function computeMonsterIdleFrame(elapsedMs: number): "idle" | "breath" {
  return Math.floor(elapsedMs / PLAYER_IDLE_FRAME_MS) % 2 === 0 ? "idle" : "breath";
}
