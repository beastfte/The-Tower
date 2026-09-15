import type { Position } from "../domain/types";
import { scalePx } from "./scaleConfig";

/** 006 US1 (008: reclassified onto living entities, not items — this module was originally
 * `itemAnimation.ts`): shared idle-bob parameters for every rendered monster/player marker,
 * adapted from the attached sprite-sheet reference's own demo formula
 * (`bobY = Math.sin((tick + item.x*9)/16) * 1.5 * G`) to this project's real elapsed-ms
 * `update(time)` and `scalePx` conventions instead of copying its tick/tile-scale units. */
/** Tuned down from the initial scalePx(2)/1500ms (008 follow-up: read as a "high jump" rather
 * than an idle sway) to a smaller, slower motion. */
export const ANIMATION_AMPLITUDE_PX = scalePx(0.5);
export const ANIMATION_PERIOD_MS = 1500;

/** Per-tile phase offset so co-located entities don't move in lockstep — uses both grid axes
 * (unlike the source's x-only offset) so a whole column doesn't move together on this
 * project's floors. Named generically (not "item" or "living") because trapAnimation.ts also
 * reuses it for spike-pit/lava per-tile phase, which is neither an item nor a living entity. */
export function computePositionPhase(position: Position): number {
  return position.x * 7 + position.y * 13;
}

/** Bounded, periodic vertical offset (px) for a given elapsed time (ms) and phase. */
export function computeBobOffset(time: number, phase: number): number {
  return Math.sin(((time + phase) / ANIMATION_PERIOD_MS) * Math.PI * 2) * ANIMATION_AMPLITUDE_PX;
}
