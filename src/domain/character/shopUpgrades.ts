import type { PlayerCharacterState, UpgradeId } from "./save";
import { healBy } from "./combatStats";

export const UPGRADE_IDS: readonly UpgradeId[] = ["vicious", "calm", "robust"];

interface UpgradeDefinition {
  label: string;
  /** The bracketed stat hint shown in the NPC dialogue box, e.g. "+5 attack" (FR-005, C16). */
  statHint: string;
  apply: (character: PlayerCharacterState) => PlayerCharacterState;
}

/** 023 FR-005/FR-008/FR-009 (contract C3): the three merchant upgrades and their stat effects.
 * `robust` bumps `baseStats.hp` (max HP — there is no separate field, `computeMaxHp` just
 * returns it) BEFORE healing, so `healBy`'s own cap already reflects the new, higher maximum —
 * this is what turns 10/30 into 15/35 rather than capping at the old ceiling.
 *
 * Labels were reworded for the 2026-09-30 dialogue-box amendment (FR-005), but the keys below
 * (`vicious`/`calm`/`robust`) are persisted `purchaseCounts` keys with no migration path — they
 * must never be renamed to match (research R17). */
export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
  vicious: {
    label: "Become more vicious",
    statHint: "+5 attack",
    apply: (character) => ({ ...character, bonusDamage: character.bonusDamage + 5 }),
  },
  calm: {
    label: "Become more sturdy",
    statHint: "+5 defence",
    apply: (character) => ({
      ...character,
      baseStats: { ...character.baseStats, defence: character.baseStats.defence + 5 },
    }),
  },
  robust: {
    label: "Become more versatile",
    statHint: "+5 max HP",
    apply: (character) => {
      const withHigherMax: PlayerCharacterState = {
        ...character,
        baseStats: { ...character.baseStats, hp: character.baseStats.hp + 5 },
      };
      return healBy(withHigherMax, 5);
    },
  },
};

/** 023 FR-006/FR-007 (contract C1): price is derived from purchase count, never stored — the
 * Nth purchase of a given upgrade always costs 5 × N gold. */
export function priceFor(character: PlayerCharacterState, id: UpgradeId): number {
  const count = character.purchaseCounts?.[id] ?? 0;
  return 5 * (count + 1);
}

/** 023 (contracts C1-C5): a pure `(character, id) -> character` transform. Returns the
 * character unchanged if unaffordable (C4); otherwise applies the upgrade's stat effect,
 * deducts exactly the price that was in effect (C5), and increments that upgrade's count —
 * always replacing `purchaseCounts` with a fresh object, never mutating the existing one
 * in place (data-model.md's aliasing invariant — mutating it would also mutate
 * `checkpointCharacter`, since a checkpoint restart replaces `character` wholesale from a
 * snapshot that may hold this exact nested object by reference). */
export function applyUpgradePurchase(character: PlayerCharacterState, id: UpgradeId): PlayerCharacterState {
  const price = priceFor(character, id);
  if (character.currency < price) return character;
  const count = character.purchaseCounts?.[id] ?? 0;
  return {
    ...UPGRADES[id].apply(character),
    currency: character.currency - price,
    purchaseCounts: { ...character.purchaseCounts, [id]: count + 1 },
  };
}
