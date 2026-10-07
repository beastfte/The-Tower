import type { CardinalDirection } from "../domain/floor/movement";
import type { PlayerDirection } from "./render/spriteData";

export type PlayerFrame = "idle" | "stepA" | "stepB" | "breath";

/** 021 research R3: no explicit millisecond timing exists on the sheet for player frames (unlike
 * TRAPS' explicit frame-hold counts) — these are converted from the sheet's own live-preview demo
 * cadence (`walkSeq`/`idleSeq`, ticked at ~60fps via requestAnimationFrame), the same conversion
 * method 007's research.md already established for SPIKE_*_MS. */
export const PLAYER_WALK_FRAME_MS = 150;
export const PLAYER_IDLE_FRAME_MS = 430;

const WALK_SEQUENCE: readonly PlayerFrame[] = ["stepA", "idle", "stepB", "idle"];
const IDLE_SEQUENCE: readonly PlayerFrame[] = ["idle", "breath"];

/** The 4-frame walking cycle (the sheet's own `walkSeq`), a pure function of elapsed time —
 * matching `computeSpikePitSegment`/`computeLavaFrame`'s shape (trapAnimation.ts) so it survives
 * `FloorScene.redraw()` recreating the player sprite on every move (research R4). */
export function computePlayerWalkFrame(elapsedMs: number): PlayerFrame {
  const index = Math.floor(elapsedMs / PLAYER_WALK_FRAME_MS) % WALK_SEQUENCE.length;
  return WALK_SEQUENCE[index]!;
}

/** The 2-frame idle-breathing loop (the sheet's own `idleSeq`) — this feature's 2026-09-29
 * clarification: idle must be this animated loop, not a single static pose. */
export function computePlayerIdleFrame(elapsedMs: number): PlayerFrame {
  const index = Math.floor(elapsedMs / PLAYER_IDLE_FRAME_MS) % IDLE_SEQUENCE.length;
  return IDLE_SEQUENCE[index]!;
}

/** 031: the sheet's "Attack Right 2f" (its frames 5 and 6) — `right`-only, combat-only art. */
export type PlayerAttackFrame = "attackA" | "attackB";

/** 031 research R7: same ~150 ms beat as PLAYER_WALK_FRAME_MS and MONSTER_ATTACK_FRAME_MS (the
 * sheet preview's 9-tick step at ~60fps). Two beats, no borrowed `breath` wind-up — attackA is
 * already a distinct wind-up pose (research R6). */
export const PLAYER_ATTACK_FRAME_MS = 150;
const ATTACK_SEQUENCE: readonly PlayerAttackFrame[] = ["attackA", "attackB"];
export const PLAYER_ATTACK_MS = PLAYER_ATTACK_FRAME_MS * ATTACK_SEQUENCE.length;

/** One swing, a pure function of elapsed time; `null` once it's over and the Prince is back at idle. */
export function computePlayerAttackFrame(elapsedMs: number): PlayerAttackFrame | null {
  return ATTACK_SEQUENCE[Math.floor(elapsedMs / PLAYER_ATTACK_FRAME_MS)] ?? null;
}

const FACING_FOR_DIRECTION: Record<CardinalDirection, PlayerDirection> = {
  up: "back",
  down: "front",
  left: "left",
  right: "right",
};

/** Maps a grid-movement direction (domain vocabulary) to the sheet's sprite-facing vocabulary
 * (data-model.md §2) — kept separate from `CardinalDirection` itself, which is a domain concept
 * for grid math and must not take on sprite-naming vocabulary. */
export function facingForDirection(direction: CardinalDirection): PlayerDirection {
  return FACING_FOR_DIRECTION[direction];
}
