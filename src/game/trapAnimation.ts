import { computePositionPhase } from "./livingAnimation";
import type { LavaTileDefinition, SpikePitDefinition } from "../domain/floor/types";

/** 007 US1: spike-pit cycle-segment lengths (ms), translated from the attached sprite-sheet
 * reference's frame-hold data (`TowerSprites.TRAPS` spike entry: 40/5/26/7 frames at an
 * assumed 60fps) per research.md #4. The two "rising"/"falling" segments are transitional
 * warning frames, not part of the dangerous window (FR-002). */
export const SPIKE_RETRACTED_MS = 670;
export const SPIKE_RISING_MS = 80;
export const SPIKE_ARMED_MS = 430;
export const SPIKE_FALLING_MS = 120;
const SPIKE_CYCLE_TOTAL_MS =
  SPIKE_RETRACTED_MS + SPIKE_RISING_MS + SPIKE_ARMED_MS + SPIKE_FALLING_MS;

const ARMED_START_MS = SPIKE_RETRACTED_MS + SPIKE_RISING_MS;
const ARMED_END_MS = ARMED_START_MS + SPIKE_ARMED_MS;

export type SpikePitSegment = "retracted" | "rising" | "armed" | "falling";

/** Which visual segment a spike pit is in at a given elapsed time, independent per tile
 * via the same per-position phase offset used for item bob (research.md #4). */
export function computeSpikePitSegment(pit: SpikePitDefinition, elapsedMs: number): SpikePitSegment {
  const t = (elapsedMs + computePositionPhase(pit.position)) % SPIKE_CYCLE_TOTAL_MS;
  if (t < SPIKE_RETRACTED_MS) return "retracted";
  if (t < ARMED_START_MS) return "rising";
  if (t < ARMED_END_MS) return "armed";
  return "falling";
}

/** Damage only applies during the fully-armed segment (FR-002) — the two transitional
 * segments only telegraph the coming state change. */
export function isSpikePitArmed(pit: SpikePitDefinition, elapsedMs: number): boolean {
  return computeSpikePitSegment(pit, elapsedMs) === "armed";
}

/** 007 US2 (follow-up clarification): lava's bubbling glow — a discrete base/glow texture
 * swap on a repeating timer, mirroring the spike pit's frame-swap technique (FR-004) instead
 * of the earlier barely-visible alpha pulse. Per-tile phase reuses computePositionPhase like
 * every other per-tile-offset case in this feature. */
export const LAVA_BASE_MS = 900;
export const LAVA_GLOW_MS = 600;
const LAVA_CYCLE_TOTAL_MS = LAVA_BASE_MS + LAVA_GLOW_MS;

export type LavaFrame = "lava" | "lava-glow";

export function computeLavaFrame(lava: LavaTileDefinition, elapsedMs: number): LavaFrame {
  const t = (elapsedMs + computePositionPhase(lava.position)) % LAVA_CYCLE_TOTAL_MS;
  return t < LAVA_BASE_MS ? "lava" : "lava-glow";
}
