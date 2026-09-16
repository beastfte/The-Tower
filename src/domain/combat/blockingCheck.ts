import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "../character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../character/types";
import { computeEffectiveStats } from "../character/combatStats";
import { simulateEncounter, type EncounterResult } from "./simulateEncounter";

export interface BlockingCheckResult {
  allowed: boolean;
  encounter: EncounterResult;
}

/**
 * The pre-combat blocking check (FR-004b): simulates the deterministic encounter using
 * the player's *effective* stats (base + equipped weapon/armor, FR-005/FR-008) against
 * the enemy's stats. If the enemy would win, the engagement is blocked before combat
 * starts; the player character can never actually be defeated in the resulting animation.
 */
export function checkEngagementAllowed(
  character: PlayerCharacterState,
  weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition>,
  armorCatalog: ReadonlyMap<string, ArmorPieceDefinition>,
  enemyStats: CombatStats,
): BlockingCheckResult {
  const playerStats = computeEffectiveStats(character, weaponCatalog, armorCatalog);
  const encounter = simulateEncounter(playerStats, enemyStats);
  return { allowed: encounter.winner === "player", encounter };
}
