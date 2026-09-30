import { DESIGN_HEIGHT, DESIGN_EVENT_LOG_HEIGHT } from "./scaleConfig";
import { UPGRADE_IDS, UPGRADES, priceFor } from "../domain/character/shopUpgrades";
import type { PlayerCharacterState, UpgradeId } from "../domain/character/save";

/** Mirrors `DESIGN_PLAY_AREA.height` (gameConfig.ts) without importing that module, which pulls
 * in the `phaser` package — this file stays Phaser-free so it's unit-testable without a scene
 * harness (research R12), matching `merchantAnimation.ts` and `shopUpgrades.ts`. */
const DIALOGUE_PLAY_AREA_HEIGHT = DESIGN_HEIGHT - DESIGN_EVENT_LOG_HEIGHT;

/** 2026-09-30 amendment (analysis finding A1): fixed at a quarter of the play area's height so
 * it isn't left to implementation-time guessing. "Undimmed" (FR-016) means no darkening/tint
 * layer over the floor, not zero occlusion — the bar covering its own footprint is expected. */
export const DIALOGUE_BAR_HEIGHT = DIALOGUE_PLAY_AREA_HEIGHT * 0.25;

/** Top edge of the bar, in DESIGN_WIDTH/DESIGN_HEIGHT-space units, anchored to the bottom of the
 * play area (FR-016, contract C14). */
export const DIALOGUE_BAR_Y = DIALOGUE_PLAY_AREA_HEIGHT - DIALOGUE_BAR_HEIGHT;

/** The enlarged portrait is sized to the bar, with a small margin (FR-017, contract C15). */
export const DIALOGUE_PORTRAIT_SIZE = DIALOGUE_BAR_HEIGHT * 0.8;

/** A single generic greeting, the same for every merchant (analysis finding U1) — per-upgrade or
 * per-merchant flavor text is out of scope for this amendment (spec.md Assumptions). */
export const MERCHANT_GREETING = "Welcome, traveler — care to trade?";

/** A clickable row in the NPC dialogue box (data-model.md "Added: `NpcDialogueOption`"). No `key`
 * field exists here — a keyboard shortcut is not expressible for a dialogue option, which is how
 * FR-018 is enforced structurally (contract C19). */
export interface NpcDialogueOption {
  text: string;
  disabled: boolean;
  onSelect: () => void;
}

/** 023 US3 (contracts C16, C17): builds the merchant's three option rows from current character
 * state. Re-run this (and only this) after every purchase — see `NpcDialogueScene`, which calls
 * its own `getOptions()` again after each `onSelect` rather than being relaunched from outside
 * (research R19, analysis finding G1). */
export function buildMerchantOptions(
  character: PlayerCharacterState,
  onPurchase: (id: UpgradeId) => void,
): NpcDialogueOption[] {
  return UPGRADE_IDS.map((id) => {
    const price = priceFor(character, id);
    return {
      text: `${UPGRADES[id].label} (${UPGRADES[id].statHint}) — ${price} gold`,
      disabled: character.currency < price,
      onSelect: () => onPurchase(id),
    };
  });
}
