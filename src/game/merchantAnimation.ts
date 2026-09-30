export type MerchantFrame = "idle" | "breath";

/** 023 US2 (research R3): the same 2-frame idle-breathing idiom as the player's own
 * `computePlayerIdleFrame` (playerAnimation.ts) — a pure function of elapsed time, matching
 * `computeSpikePitSegment`/`computeLavaFrame`'s shape so it survives `FloorScene.redraw()`
 * recreating the merchant's sprite on every move. Reuses the player's own idle cadence rather
 * than inventing a new constant — both are the sheet's "breathing NPC" idle loop. */
export const MERCHANT_IDLE_FRAME_MS = 430;

const IDLE_SEQUENCE: readonly MerchantFrame[] = ["idle", "breath"];

export function computeMerchantIdleFrame(elapsedMs: number): MerchantFrame {
  const index = Math.floor(elapsedMs / MERCHANT_IDLE_FRAME_MS) % IDLE_SEQUENCE.length;
  return IDLE_SEQUENCE[index]!;
}
