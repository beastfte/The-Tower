import type { Position } from "../domain/types";
import { scalePx } from "./scaleConfig";

/** 006 US1: shared idle-bob parameters for every floor-item pickup marker (research.md #2),
 * adapted from the attached sprite-sheet reference's own demo formula
 * (`bobY = Math.sin((tick + item.x*9)/16) * 1.5 * G`) to this project's real elapsed-ms
 * `update(time)` and `scalePx` conventions instead of copying its tick/tile-scale units. */
export const ANIMATION_AMPLITUDE_PX = scalePx(2);
export const ANIMATION_PERIOD_MS = 1500;

/** Per-item phase offset so items don't bob in lockstep — uses both grid axes (unlike the
 * source's x-only offset) so a whole column doesn't move together on this project's floors. */
export function computeItemPhase(position: Position): number {
  return position.x * 7 + position.y * 13;
}

/** Bounded, periodic vertical offset (px) for a given elapsed time (ms) and phase. */
export function computeBobOffset(time: number, phase: number): number {
  return Math.sin(((time + phase) / ANIMATION_PERIOD_MS) * Math.PI * 2) * ANIMATION_AMPLITUDE_PX;
}
